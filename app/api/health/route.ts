import { NextResponse } from "next/server";
import { config, resolveMode, UNIVERSE } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Status = "ok" | "not_configured" | "error";
interface Check {
  name: string;
  status: Status;
  detail: string;
  required: "core" | "optional";
}

const ok = (name: string, detail: string, required: Check["required"] = "optional"): Check => ({ name, status: "ok", detail, required });
const off = (name: string, detail: string, required: Check["required"] = "optional"): Check => ({ name, status: "not_configured", detail, required });
const bad = (name: string, detail: string, required: Check["required"] = "optional"): Check => ({ name, status: "error", detail, required });

async function timed<T>(fn: () => Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}

/** LLM provider — a 1-token round trip proves the key + base URL work. */
async function checkLlm(): Promise<Check> {
  if (!config.llm.configured) return off("llm", `${config.llm.label} not configured. ${config.llm.signupHint}`, "core");
  try {
    return await timed(async () => {
      const res = await fetch(`${config.llm.baseURL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(config.llm.apiKey ? { Authorization: `Bearer ${config.llm.apiKey}` } : {}) },
        body: JSON.stringify({ model: config.models.planner, max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      });
      if (!res.ok) return bad("llm", `${config.llm.label} ${res.status}: ${(await res.text()).slice(0, 160)}`, "core");
      return ok("llm", `${config.llm.label} · planner=${config.models.planner} · synth=${config.models.synth}`, "core");
    });
  } catch (e) {
    return bad("llm", `${config.llm.label} unreachable: ${(e as Error).message}`, "core");
  }
}

/** SEC EDGAR — the highest-value source; needs a descriptive User-Agent. */
async function checkSec(): Promise<Check> {
  try {
    return await timed(async () => {
      const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${UNIVERSE.NVDA.cik}.json`, {
        headers: { "User-Agent": config.sec.userAgent, Accept: "application/json" },
      });
      if (!res.ok) return bad("sec_edgar", `EDGAR ${res.status} — check SEC_USER_AGENT has a real contact email`, "core");
      return ok("sec_edgar", `XBRL reachable · UA="${config.sec.userAgent.slice(0, 42)}…"`, "core");
    });
  } catch (e) {
    return bad("sec_edgar", `EDGAR unreachable: ${(e as Error).message}`, "core");
  }
}

/** Supabase — powers filing RAG, memo persistence, and the calibration record. */
async function checkSupabase(): Promise<Check[]> {
  if (!config.supabase.enabled) {
    return [off("supabase", "No NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — track record + RAG fall back to demo data")];
  }
  const headers = { apikey: config.supabase.serviceKey, Authorization: `Bearer ${config.supabase.serviceKey}` };
  try {
    return await timed(async () => {
      const res = await fetch(`${config.supabase.url}/rest/v1/filing_chunks?select=id&limit=1`, {
        headers: { ...headers, Prefer: "count=exact" },
      });
      if (res.status === 404) {
        return [bad("supabase", "Connected, but table `filing_chunks` is missing — run supabase/schema.sql")];
      }
      if (!res.ok) return [bad("supabase", `Supabase ${res.status}: ${(await res.text()).slice(0, 160)}`)];
      const total = res.headers.get("content-range")?.split("/")?.[1] ?? "?";
      const chunks = Number(total);
      const checks: Check[] = [ok("supabase", `Connected · schema present`)];
      checks.push(
        chunks > 0
          ? ok("filing_rag", `${total} filing chunks ingested`)
          : off("filing_rag", "0 filing chunks — run: python ingestion/ingest.py NVDA (search_filings returns nothing until then)"),
      );
      return checks;
    });
  } catch (e) {
    const msg = (e as Error).message;
    const hint = /fetch failed|ENOTFOUND|getaddrinfo/i.test(msg)
      ? " — host does not resolve. Verify the Project URL in Supabase → Settings → API (a paused free project also stops resolving)."
      : "";
    return [bad("supabase", `Unreachable: ${msg}${hint}`)];
  }
}

/** Embeddings — required for filing RAG retrieval. */
async function checkEmbeddings(): Promise<Check> {
  const p = config.embedding.provider;
  const key = p === "gemini" ? process.env.GEMINI_API_KEY : p === "voyage" ? process.env.VOYAGE_API_KEY : "local";
  if (p !== "ollama" && !key) return off("embeddings", `${p} embeddings not configured`);
  const base =
    p === "gemini"
      ? "https://generativelanguage.googleapis.com/v1beta/openai"
      : p === "ollama"
        ? (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1").replace(/\/$/, "")
        : "https://api.voyageai.com/v1";
  try {
    return await timed(async () => {
      const res = await fetch(`${base}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key && key !== "local" ? { Authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({
          model: config.embedding.model,
          input: "health check",
          ...(p === "gemini" ? { dimensions: config.embedding.dim } : {}),
        }),
      });
      if (!res.ok) return bad("embeddings", `${p} ${res.status}: ${(await res.text()).slice(0, 160)}`);
      const json = (await res.json()) as { data?: { embedding?: number[] }[] };
      const dim = json.data?.[0]?.embedding?.length ?? 0;
      if (dim !== config.embedding.dim) {
        return bad("embeddings", `Returned ${dim} dims but CANDOR_EMBEDDING_DIM=${config.embedding.dim} — must match vector(dim) in the SQL schema`);
      }
      return ok("embeddings", `${p} · ${config.embedding.model} · ${dim} dims`);
    });
  } catch (e) {
    return bad("embeddings", `${p} unreachable: ${(e as Error).message}`);
  }
}

/** Market data — needed to resolve calibration outcomes. */
async function checkMarket(): Promise<Check> {
  const av = process.env.ALPHAVANTAGE_API_KEY;
  const fh = process.env.FINNHUB_API_KEY;
  if (!av && !fh) return off("market_data", "No ALPHAVANTAGE_API_KEY / FINNHUB_API_KEY — news tool + calibration resolver disabled");
  try {
    return await timed(async () => {
      if (fh) {
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=NVDA&token=${fh}`);
        if (!res.ok) return bad("market_data", `Finnhub ${res.status}`);
        return ok("market_data", `Finnhub reachable${av ? " · Alpha Vantage key present" : ""}`);
      }
      return ok("market_data", "Alpha Vantage key present");
    });
  } catch (e) {
    return bad("market_data", `Unreachable: ${(e as Error).message}`);
  }
}

/**
 * GET /api/health — one call that tells you exactly which parts of the live
 * stack are wired, and what to do about the parts that aren't.
 */
export async function GET() {
  const started = Date.now();
  const [llm, sec, supabase, embeddings, market] = await Promise.all([
    checkLlm(),
    checkSec(),
    checkSupabase(),
    checkEmbeddings(),
    checkMarket(),
  ]);

  const checks: Check[] = [llm, sec, ...supabase, embeddings, market];
  const coreBroken = checks.filter((c) => c.required === "core" && c.status !== "ok");
  const degraded = checks.filter((c) => c.status !== "ok");

  return NextResponse.json(
    {
      mode: resolveMode(),
      killSwitch: config.killSwitch,
      provider: config.llm.provider,
      healthy: coreBroken.length === 0,
      summary: coreBroken.length
        ? `${coreBroken.length} core check(s) failing — live memos will fall back to demo`
        : degraded.length
          ? `Core stack healthy · ${degraded.length} optional feature(s) inactive`
          : "All systems live",
      checks,
      tookMs: Date.now() - started,
    },
    { status: coreBroken.length ? 503 : 200 },
  );
}
