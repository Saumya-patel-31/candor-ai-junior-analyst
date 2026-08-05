import { z } from "zod";

/* ════════════════════════════════════════════════════════════════════════
   Tools
   ════════════════════════════════════════════════════════════════════════ */
export const TOOL_NAMES = [
  "get_fundamentals",
  "search_filings",
  "get_recent_news",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const TOOL_META: Record<ToolName, { label: string; source: string; blurb: string }> = {
  get_fundamentals: {
    label: "Fundamentals",
    source: "XBRL · data.sec.gov",
    blurb: "Structured financials straight from filings — revenue, margins, debt.",
  },
  search_filings: {
    label: "Filings RAG",
    source: "EDGAR 10-K / 10-Q",
    blurb: "Hybrid retrieval over risk-factor & MD&A sections.",
  },
  get_recent_news: {
    label: "News",
    source: "Finnhub / NewsAPI",
    blurb: "Recent headlines and their framing per ticker.",
  },
};

/* ════════════════════════════════════════════════════════════════════════
   Memo — the FORCED output schema of the synthesizer.
   Every claim must map to a citation id. Zod validates the model's JSON.
   ════════════════════════════════════════════════════════════════════════ */
export const SourceKind = z.enum(["10-K", "10-Q", "XBRL", "news", "market"]);
export type SourceKind = z.infer<typeof SourceKind>;

/* ── Tolerant field helpers ───────────────────────────────────────────────
   Open-weight models drift on JSON contracts in predictable ways: they emit
   `null` instead of omitting an optional field, stringify single-element
   arrays ("c1" not ["c1"]), Title-Case enums, and wrap numbers in "%"/"$".
   These helpers absorb that deterministically so a good memo isn't thrown away
   over formatting. The resulting TS types stay exactly as strict as before. */

/** Optional field that also tolerates null / "" / "N/A" / "unknown". */
const optish = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === "string") {
      const s = v.trim();
      if (s === "" || /^(n\/?a|none|null|unknown|tbd)$/i.test(s)) return undefined;
    }
    return v;
  }, schema.optional());

/** Enum that tolerates casing/whitespace ("High" → "high").
 *  `const T` keeps the literal union in the inferred type. */
const looseEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.enum(values));

/** Number that tolerates "12.4%", "$1,200", "+0.12". */
const looseNumber = z.preprocess((v) => {
  if (typeof v === "string") {
    const n = Number(v.replace(/[%,$\s+]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return v;
}, z.number());

/** Anything → string ("128.4" for a number value field). */
const looseString = z.preprocess(
  (v) => (typeof v === "number" || typeof v === "boolean" ? String(v) : v),
  z.string(),
);

/** "c1" | ["c1","c2"] | null → string[] */
const idList = z
  .preprocess((v) => {
    if (v === null || v === undefined) return [];
    if (typeof v === "string") {
      // handles "c1" and "c1, c2"
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    return [];
  }, z.array(z.string()))
  .default([]);

/** Normalize common citation-kind variants ("10K" → "10-K", "sec" → "10-K"). */
const looseKind = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const s = v.trim().toLowerCase().replace(/\s+/g, "");
  if (/^10-?k$/.test(s) || s === "sec" || s === "filing") return "10-K";
  if (/^10-?q$/.test(s)) return "10-Q";
  if (s === "xbrl" || s === "fundamentals" || s === "companyfacts") return "XBRL";
  if (s === "news" || s === "headline" || s === "article") return "news";
  if (s === "market" || s === "price" || s === "quote") return "market";
  return v;
}, SourceKind);

export const CitationSchema = z.object({
  id: looseString, // e.g. "c1"
  kind: looseKind,
  title: looseString,
  snippet: looseString,
  url: optish(z.string()),
  locator: optish(z.string()), // "Item 1A, p.24" | "FY2024 10-K"
  filedAt: optish(z.string()),
});
export type Citation = z.infer<typeof CitationSchema>;

export const MetricSchema = z.object({
  label: looseString,
  value: looseString,
  raw: optish(looseNumber),
  delta: optish(looseNumber), // YoY % as decimal, e.g. 0.122
  trend: optish(looseEnum(["up", "down", "flat"])),
  commentary: optish(z.string()),
  citationId: optish(z.string()),
});
export type Metric = z.infer<typeof MetricSchema>;

export const RiskSchema = z.object({
  id: looseString,
  title: looseString,
  detail: looseString,
  severity: looseEnum(["low", "medium", "high"]),
  citationIds: idList,
});
export type Risk = z.infer<typeof RiskSchema>;

export const CatalystSchema = z.object({
  id: looseString,
  title: looseString,
  detail: looseString,
  likelihood: looseEnum(["low", "medium", "high"]),
  horizon: optish(z.string()), // "next 2 quarters"
  citationIds: idList,
});
export type Catalyst = z.infer<typeof CatalystSchema>;

export const CritiqueSchema = z.object({
  verdict: looseEnum(["passed", "revised", "flagged"]),
  supportedClaims: looseNumber,
  totalClaims: looseNumber,
  unsupportedRemoved: z
    .preprocess(
      (v) => (v == null ? [] : v),
      z.array(z.object({ claim: looseString, reason: looseString })),
    )
    .default([]),
  contradictions: z
    .preprocess(
      (v) => (v == null ? [] : v),
      z.array(
        z.object({ claim: looseString, evidence: looseString, citationId: optish(z.string()) }),
      ),
    )
    .default([]),
  confidenceAdjustment: z.preprocess((v) => (v == null ? 0 : v), looseNumber).default(0),
  notes: looseString,
});
export type Critique = z.infer<typeof CritiqueSchema>;

/** The pure model output (what the synthesizer must return). */
export const MemoDraftSchema = z.object({
  thesis: looseString.pipe(z.string().min(1)),
  // Analytical posture — deliberately NOT a buy/sell call.
  stance: looseEnum(["constructive", "cautious", "mixed", "neutral"]),
  // Clamp rather than reject: a 0–100 score emitted as 0–1 or 105 is still usable.
  confidenceScore: z.preprocess((v) => {
    const n = typeof v === "string" ? Number(v.replace(/[%\s]/g, "")) : v;
    if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
    const scaled = n > 0 && n <= 1 ? n * 100 : n;
    return Math.max(0, Math.min(100, Math.round(scaled)));
  }, z.number().min(0).max(100)),
  confidenceRationale: looseString,
  keyMetrics: z.preprocess((v) => (v == null ? [] : v), z.array(MetricSchema)).default([]),
  risks: z.preprocess((v) => (v == null ? [] : v), z.array(RiskSchema)).default([]),
  catalysts: z.preprocess((v) => (v == null ? [] : v), z.array(CatalystSchema)).default([]),
  citations: z.preprocess((v) => (v == null ? [] : v), z.array(CitationSchema)).default([]),
});
export type MemoDraft = z.infer<typeof MemoDraftSchema>;

export interface CostTotals {
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  toolCalls: number;
  byModel: Record<string, { tokensIn: number; tokensOut: number; costUsd: number; calls: number }>;
}

/** A completed, published memo (draft + critique + provenance + guardrails). */
export interface Memo extends MemoDraft {
  id: string;
  ticker: string;
  company: string;
  sector: string;
  question: string;
  asOf: string;
  critique: Critique;
  disclaimer: string;
  toolCalls: ToolCallRecord[];
  cost: CostTotals;
  mode: "demo" | "live";
  publishedToTrackRecord: boolean;
}

/* ════════════════════════════════════════════════════════════════════════
   Tool-call telemetry (cost/latency log → the `tool_calls` table)
   ════════════════════════════════════════════════════════════════════════ */
export interface ToolCallRecord {
  id: string;
  tool: ToolName;
  args: Record<string, unknown>;
  status: "queued" | "running" | "success" | "error";
  startedAt: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  resultSummary: string;
  citationsProduced: number;
}

/* ════════════════════════════════════════════════════════════════════════
   Planner output
   ════════════════════════════════════════════════════════════════════════ */
export interface PlanStep {
  id: string;
  tool: ToolName;
  rationale: string;
  query?: string;
  dependsOn?: string[];
  parallelGroup?: number;
}
export interface Plan {
  interpretation: string;
  steps: PlanStep[];
}

/* ════════════════════════════════════════════════════════════════════════
   Pipeline events — streamed to the terminal UI over SSE
   ════════════════════════════════════════════════════════════════════════ */
export type Phase =
  | "planning"
  | "retrieving"
  | "synthesizing"
  | "critiquing"
  | "finalizing"
  | "done";

export type PipelineEvent =
  | { type: "status"; phase: Phase; message: string; ts: number }
  | { type: "plan"; plan: Plan; ts: number }
  | { type: "tool_start"; call: Pick<ToolCallRecord, "id" | "tool" | "args"> & { rationale: string }; ts: number }
  | { type: "tool_delta"; id: string; line: string; ts: number }
  | { type: "tool_end"; call: ToolCallRecord; ts: number }
  | { type: "thinking"; phase: Phase; delta: string; ts: number }
  | { type: "draft"; draft: MemoDraft; ts: number }
  | { type: "critique"; critique: Critique; ts: number }
  | { type: "cost"; totals: CostTotals; ts: number }
  | { type: "final"; memo: Memo; ts: number }
  | { type: "error"; message: string; ts: number }
  | { type: "done"; ts: number };

/* ════════════════════════════════════════════════════════════════════════
   Calibration / public track record
   ════════════════════════════════════════════════════════════════════════ */
export interface CalibrationRecord {
  memoId: string;
  ticker: string;
  company: string;
  question: string;
  confidenceScore: number;
  stance: MemoDraft["stance"];
  asOf: string;
  horizonDays: number;
  resolved: boolean;
  /** Did the thesis's directional read hold over the horizon? (calibration, not stock-picking) */
  correct?: boolean;
  resolvedAt?: string;
  note?: string;
}

export interface ReliabilityBin {
  bucket: string; // "50–60"
  midpoint: number; // 0..1
  predicted: number; // avg stated confidence in bin (0..1)
  observed: number; // fraction that resolved correct (0..1)
  count: number;
}

export interface CalibrationSummary {
  totalMemos: number;
  resolved: number;
  brierScore: number; // lower is better
  ece: number; // expected calibration error (0..1), lower is better
  overconfidence: number; // signed: predicted − observed
  bins: ReliabilityBin[];
  trend: { date: string; ece: number; brier: number; resolved: number }[];
}
