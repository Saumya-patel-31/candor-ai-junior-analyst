import { z } from "zod";
import { providerChain, tokenCost, type ProviderRuntime } from "@/lib/config";

const PROVIDERS_HINT =
  "Set CEREBRAS_API_KEY (1M tokens/day free, cloud.cerebras.ai), GROQ_API_KEY, or GEMINI_API_KEY.";

/**
 * Provider-agnostic LLM client. Talks to ANY OpenAI-compatible endpoint
 * (Groq / Gemini / OpenRouter / Ollama) over a single fetch path. This is how
 * Candor runs fully free — swap CANDOR_LLM_PROVIDER.
 */

export interface CallUsage {
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
}

/** Pull a JSON object out of a model response that may wrap it in prose/fences. */
function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model output");
  return JSON.parse(candidate.slice(start, end + 1));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Free tiers are token-per-minute capped. Providers tell us how long to wait —
 *  honor `Retry-After`, else parse "try again in 7.79s" from the error body. */
function retryDelayMs(res: Response, body: string): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const secs = Number(header);
    if (Number.isFinite(secs)) return Math.ceil(secs * 1000);
  }
  const m = body.match(/try again in ([\d.]+)\s*(ms|s)\b/i);
  if (m) {
    const n = Number(m[1]);
    return Math.ceil(m[2].toLowerCase() === "ms" ? n : n * 1000);
  }
  return 8000;
}

/** A daily/quota exhaustion should switch providers, not sit in a retry loop. */
function isQuotaExhausted(status: number, body: string): boolean {
  if (status !== 429) return false;
  return /per day|daily|TPD|RPD|quota|exhausted|insufficient/i.test(body);
}

/** One provider attempt, with short-wait retries for transient/per-minute limits. */
async function chatOnProvider(
  p: ProviderRuntime,
  opts: { model: string; system: string; user: string; maxTokens: number; temperature: number },
): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const MAX_ATTEMPTS = 3;
  let lastErr = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${p.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}),
        // OpenRouter courtesy headers (ignored elsewhere).
        "HTTP-Referer": "https://candor.local",
        "X-Title": "Candor AI Junior Analyst",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
    });

    if (res.ok) {
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        text: json.choices?.[0]?.message?.content ?? "",
        tokensIn: json.usage?.prompt_tokens ?? 0,
        tokensOut: json.usage?.completion_tokens ?? 0,
      };
    }

    const body = await res.text().catch(() => "");
    lastErr = `${p.label} ${res.status}: ${body.slice(0, 240)}`;

    // Daily budget gone — no point waiting, hand off to the next provider.
    if (isQuotaExhausted(res.status, body)) throw new QuotaExhausted(lastErr);

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) break;

    const waitMs = res.status === 429 ? retryDelayMs(res, body) + 500 : 1000 * attempt;
    // Long per-minute waits are also better spent on another provider.
    if (waitMs > 20_000) throw new QuotaExhausted(lastErr);
    console.warn(`[candor] ${res.status} from ${p.label}; retry in ${waitMs}ms (${attempt}/${MAX_ATTEMPTS})`);
    await sleep(waitMs);
  }

  throw new Error(lastErr);
}

class QuotaExhausted extends Error {}

/**
 * Try each configured provider in turn. Free tiers have hard daily caps, so the
 * agent keeps working by moving down the chain (Cerebras → Groq → Gemini → …)
 * rather than failing the request.
 */
async function openAICompatibleChat(opts: {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  tier: "planner" | "synth";
}): Promise<{ text: string; tokensIn: number; tokensOut: number; model: string; provider: string }> {
  const chain = providerChain();
  if (!chain.length) throw new Error("No LLM provider configured. Set CEREBRAS_API_KEY or GROQ_API_KEY.");

  // Collect EVERY provider's failure. Reporting only the last one hides which
  // provider actually broke and why — useless when several are chained.
  const failures: string[] = [];
  for (const p of chain) {
    // Each provider names its models differently — use its own tier mapping,
    // unless the caller pinned an explicit model via env override.
    const model = opts.model || (opts.tier === "planner" ? p.planner : p.synth);
    try {
      const r = await chatOnProvider(p, { ...opts, model });
      return { ...r, model, provider: p.name };
    } catch (e) {
      const reason = e instanceof QuotaExhausted ? "quota" : "error";
      const detail = (e as Error).message.replace(/\s+/g, " ").slice(0, 150);
      failures.push(`${p.label}[${model}] ${reason}: ${detail}`);
      console.warn(`[candor] ${p.label} (${model}) ${reason} — ${detail}`);
    }
  }
  throw new Error(`All ${chain.length} provider(s) failed → ${failures.join(" | ")}`);
}

/**
 * Call a model and coerce its output into a Zod schema — how we "force" the
 * memo / plan / critique JSON contracts across any provider.
 */
export async function callJSON<S extends z.ZodTypeAny>(opts: {
  model: string;
  system: string;
  user: string;
  schema: S;
  maxTokens?: number;
  temperature?: number;
  tier?: "planner" | "synth";
}): Promise<{ data: z.infer<S>; usage: CallUsage }> {
  if (!providerChain().length) {
    throw new Error(
      `No LLM provider configured. ${PROVIDERS_HINT}`,
    );
  }
  const started = Date.now();
  const maxTokens = opts.maxTokens ?? 4096;
  const temperature = opts.temperature ?? 0.4;
  const tier = opts.tier ?? "synth";

  let tokensIn = 0;
  let tokensOut = 0;
  let servedModel = opts.model;
  const call = async (user: string, temp: number) => {
    const r = await openAICompatibleChat({
      model: opts.model,
      system: opts.system,
      user,
      maxTokens,
      temperature: temp,
      tier,
    });
    tokensIn += r.tokensIn;
    tokensOut += r.tokensOut;
    servedModel = r.model;
    return r.text;
  };

  const text = await call(opts.user, temperature);

  let data: z.infer<S>;
  try {
    data = opts.schema.parse(parseJsonLoose(text)) as z.infer<S>;
  } catch (firstErr) {
    // Self-repair: hand the model its own output plus the validation errors and
    // ask for a corrected object. Open-weight models usually fix it in one pass.
    const problem = firstErr instanceof z.ZodError
      ? firstErr.issues.map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n")
      : String(firstErr);
    const repairPrompt = `Your previous response did not satisfy the required JSON schema.

PREVIOUS RESPONSE:
${text.slice(0, 6000)}

VALIDATION ERRORS:
${problem}

Return the CORRECTED object as raw JSON only. Rules: omit optional fields entirely instead of using null; arrays must be arrays (["c1"], never "c1"); enums must be lowercase exactly as specified; numbers must be plain numbers (no % or $).`;
    const repaired = await call(repairPrompt, 0);
    data = opts.schema.parse(parseJsonLoose(repaired)) as z.infer<S>;
  }

  const latencyMs = Date.now() - started;
  return {
    data,
    usage: { model: servedModel, tokensIn, tokensOut, costUsd: tokenCost(servedModel, tokensIn, tokensOut), latencyMs },
  };
}
