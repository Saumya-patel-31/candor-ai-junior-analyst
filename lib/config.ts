/**
 * Central configuration — LLM provider registry, model tiers, cost table, flags,
 * and the demo universe.
 *
 * Candor is PROVIDER-AGNOSTIC. The agent talks to any OpenAI-compatible endpoint,
 * so you can run it fully FREE:
 *   - groq       → free, no credit card, very fast (default)
 *   - gemini     → free tier, also does free embeddings
 *   - openrouter → free `:free` models
 *   - ollama     → 100% local, no key, no network
 */

export type RunMode = "demo" | "live";
export type LlmProvider = "cerebras" | "groq" | "gemini" | "openrouter" | "ollama";

function env(key: string, fallback = ""): string {
  // Treat empty/whitespace values the same as unset, so blank .env lines
  // (e.g. `CANDOR_MODEL_PLANNER=`) fall back to the provider default.
  const v = (process.env[key] ?? "").trim();
  return v === "" ? fallback : v;
}

interface ProviderSpec {
  label: string;
  baseURL: string;
  keyEnv: string; // "" → no key needed (ollama)
  planner: string; // cheap/frequent tier
  synth: string; // quality tier
  openaiCompatible: boolean;
  signupHint: string;
}

const PROVIDERS: Record<LlmProvider, ProviderSpec> = {
  cerebras: {
    label: "Cerebras",
    baseURL: "https://api.cerebras.ai/v1",
    keyEnv: "CEREBRAS_API_KEY",
    // Verified against GET /v1/models — Cerebras rotates its catalogue, so check
    // there first if you get a 404 ("model does not exist").
    planner: "gemma-4-31b",
    synth: "gpt-oss-120b",
    openaiCompatible: true,
    signupHint: "Free key (1M tokens/day, no card): cloud.cerebras.ai",
  },
  groq: {
    label: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    // 8b-instant has the highest request budget (~14.4k/day) → planning.
    // llama-3.3-70b-versatile is the only free model verified to hold the forced-JSON
    // contract end-to-end here. Reasoning-style models (nemotron, gpt-oss) spend their
    // output budget on chain-of-thought and return truncated or absent JSON.
    planner: "llama-3.1-8b-instant",
    synth: "llama-3.3-70b-versatile",
    openaiCompatible: true,
    signupHint: "Free key (no card): console.groq.com/keys",
  },
  gemini: {
    label: "Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY",
    // flash-lite was retired — both tiers use flash.
    planner: "gemini-2.5-flash",
    synth: "gemini-2.5-flash",
    openaiCompatible: true,
    signupHint: "Free key: aistudio.google.com/apikey",
  },
  openrouter: {
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    keyEnv: "OPENROUTER_API_KEY",
    // ":free" slugs are withdrawn without notice — verify against
    // GET https://openrouter.ai/api/v1/models if you see a 404.
    // Use INSTRUCTION-TUNED models here. Reasoning models (nemotron, gpt-oss)
    // spend their output budget on chain-of-thought and return truncated or
    // absent JSON, which is useless for a forced-schema contract.
    planner: "google/gemma-4-26b-a4b-it:free",
    synth: "google/gemma-4-31b-it:free",
    openaiCompatible: true,
    signupHint: "Free key: openrouter.ai/keys (pick any :free model)",
  },
  ollama: {
    label: "Ollama (local)",
    baseURL: env("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
    keyEnv: "",
    planner: env("OLLAMA_MODEL", "llama3.1"),
    synth: env("OLLAMA_MODEL", "llama3.1"),
    openaiCompatible: true,
    signupHint: "Local, free: `ollama pull llama3.1`",
  },
};

function activeProvider(): LlmProvider {
  const p = env("CANDOR_LLM_PROVIDER", "cerebras") as LlmProvider;
  return p in PROVIDERS ? p : "cerebras";
}

function providerConfigured(p: LlmProvider): boolean {
  const spec = PROVIDERS[p];
  return spec.keyEnv === "" ? true : env(spec.keyEnv).length > 0;
}

/** Runtime view of one provider, used by the failover chain. */
export interface ProviderRuntime {
  name: LlmProvider;
  label: string;
  baseURL: string;
  apiKey: string;
  planner: string;
  synth: string;
  signupHint: string;
}

function runtimeFor(p: LlmProvider): ProviderRuntime {
  const s = PROVIDERS[p];
  return {
    name: p,
    label: s.label,
    baseURL: s.baseURL.replace(/\/$/, ""),
    apiKey: s.keyEnv ? env(s.keyEnv) : "",
    planner: s.planner,
    synth: s.synth,
    signupHint: s.signupHint,
  };
}

/**
 * Ordered list of configured providers: the primary first, then every other
 * provider that has a key. Free tiers have hard daily caps, so when one is
 * exhausted the agent transparently continues on the next instead of failing.
 * Combined free budget across Cerebras + Groq + Gemini is >1M tokens/day.
 */
export function providerChain(): ProviderRuntime[] {
  const primary = activeProvider();
  // Auto-fallback only to providers with stable free tiers. OpenRouter's ":free"
  // slugs are withdrawn without notice (and it allows just 50 req/day), and Ollama
  // is local-only — both are usable, but only when chosen explicitly as primary.
  const AUTO_FALLBACK: LlmProvider[] = ["cerebras", "groq", "gemini"];
  const order: LlmProvider[] = [primary, ...AUTO_FALLBACK.filter((p) => p !== primary)];
  return order.filter(providerConfigured).map(runtimeFor);
}

/**
 * Live mode requires: opt-in (CANDOR_MODE=live) AND the active provider is
 * configured AND the kill switch is off. Otherwise we degrade to the demo.
 */
export function resolveMode(): RunMode {
  const killed = env("CANDOR_KILL_SWITCH", "false") === "true";
  const wantsLive = env("CANDOR_MODE", "demo") === "live";
  return !killed && wantsLive && providerConfigured(activeProvider()) ? "live" : "demo";
}

const provider = activeProvider();
const spec = PROVIDERS[provider];

export const config = {
  mode: resolveMode(),
  killSwitch: env("CANDOR_KILL_SWITCH", "false") === "true",
  dailyQueryCap: Number(env("CANDOR_DAILY_QUERY_CAP", "25")),

  llm: {
    provider,
    label: spec.label,
    baseURL: spec.baseURL.replace(/\/$/, ""),
    apiKey: spec.keyEnv ? env(spec.keyEnv) : "",
    openaiCompatible: spec.openaiCompatible,
    configured: providerConfigured(provider),
    signupHint: spec.signupHint,
  },

  // Display/default names for the PRIMARY provider (used by the dashboard and the
  // demo dataset). At call time the agent passes `modelOverrides` instead, so each
  // provider in the failover chain can use its own model naming.
  models: {
    // Cheap + frequent → planning / routing.
    planner: env("CANDOR_MODEL_PLANNER", spec.planner),
    // Quality where it matters → synthesis + self-critique.
    synth: env("CANDOR_MODEL_SYNTH", spec.synth),
    critic: env("CANDOR_MODEL_CRITIC", spec.synth),
  },

  /** Only set when explicitly pinned via env; "" means "let the provider choose". */
  modelOverrides: {
    planner: env("CANDOR_MODEL_PLANNER"),
    synth: env("CANDOR_MODEL_SYNTH"),
    critic: env("CANDOR_MODEL_CRITIC"),
  },

  // REFERENCE pricing (USD / 1M tokens) at each provider's list rates. On the free
  // tier your ACTUAL marginal cost is $0 — this powers a "what it would cost at scale"
  // estimate so the model-routing story survives. Unknown models fall back to `default`.
  pricing: {
    "gemma-4-31b": { in: 0.1, out: 0.1 },
    "gpt-oss-120b": { in: 0.35, out: 0.75 },
    "zai-glm-4.7": { in: 0.5, out: 0.9 },
    "llama-3.1-8b-instant": { in: 0.05, out: 0.08 },
    "openai/gpt-oss-120b": { in: 0.15, out: 0.6 },
    "llama-3.3-70b-versatile": { in: 0.59, out: 0.79 },
    "gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
    "gemini-2.5-flash": { in: 0.3, out: 2.5 },
    default: { in: 0.2, out: 0.6 },
  } as Record<string, { in: number; out: number }>,

  embedding: {
    provider: env("CANDOR_EMBED_PROVIDER", "gemini"),
    model: env("CANDOR_EMBEDDING_MODEL", "gemini-embedding-001"),
    dim: Number(env("CANDOR_EMBEDDING_DIM", "768")),
  },

  sec: {
    userAgent: env("SEC_USER_AGENT", "Candor Research student-project contact@example.com"),
    maxRps: 8,
  },

  supabase: {
    url: env("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
    enabled: Boolean(env("NEXT_PUBLIC_SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY")),
  },
};

export function tokenCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = config.pricing[model] ?? config.pricing.default;
  return (tokensIn / 1e6) * p.in + (tokensOut / 1e6) * p.out;
}

/** Starter coverage universe (a slice of the S&P 100 is plenty for v1). */
export const UNIVERSE: Record<string, { name: string; sector: string; cik: string }> = {
  NVDA: { name: "NVIDIA Corporation", sector: "Semiconductors", cik: "0001045810" },
  AAPL: { name: "Apple Inc.", sector: "Consumer Electronics", cik: "0000320193" },
  MSFT: { name: "Microsoft Corporation", sector: "Software", cik: "0000789019" },
  AMZN: { name: "Amazon.com, Inc.", sector: "E-Commerce / Cloud", cik: "0001018724" },
  GOOGL: { name: "Alphabet Inc.", sector: "Internet", cik: "0001652044" },
  META: { name: "Meta Platforms, Inc.", sector: "Social / Advertising", cik: "0001326801" },
  TSLA: { name: "Tesla, Inc.", sector: "Autos / Energy", cik: "0001318605" },
  DIS: { name: "The Walt Disney Company", sector: "Media / Streaming", cik: "0001744489" },
  AMD: { name: "Advanced Micro Devices, Inc.", sector: "Semiconductors", cik: "0000002488" },
  NFLX: { name: "Netflix, Inc.", sector: "Streaming", cik: "0001065280" },
  JPM: { name: "JPMorgan Chase & Co.", sector: "Banking", cik: "0000019617" },
  KO: { name: "The Coca-Cola Company", sector: "Beverages", cik: "0000021344" },
};

export const DISCLAIMER =
  "Candor is an educational research tool, not a licensed investment adviser. This memo is an AI-generated synthesis of public information for informational purposes only — it is not investment advice, not a recommendation to buy, sell, or hold any security, and not tailored to anyone's financial situation. Data may be incomplete or out of date. Do your own research and consult a licensed professional before making any financial decision.";
