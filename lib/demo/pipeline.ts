import { config, DISCLAIMER, UNIVERSE, tokenCost } from "@/lib/config";
import { sleep } from "@/lib/utils";
import type {
  CostTotals,
  Memo,
  MemoDraft,
  PipelineEvent,
  Plan,
  ToolCallRecord,
  ToolName,
} from "@/lib/types";
import { MEMOS } from "./mockMemos";

const now = () => Date.now();

/** Split text into word-ish chunks for a streaming type-on effect. */
function chunks(text: string, size = 3): string[] {
  const words = text.split(/(\s+)/);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += size) {
    out.push(words.slice(i, i + size).join(""));
  }
  return out;
}

/** Build a plausible memo for any covered ticker not in the curated set. */
function buildGenericMemo(ticker: string, question: string): Memo {
  const u = UNIVERSE[ticker] ?? { name: `${ticker} Inc.`, sector: "Equity", cik: "" };
  const conf = 55 + Math.round(Math.sin(ticker.charCodeAt(0)) * 10);
  return {
    id: `memo_${ticker.toLowerCase()}_gen`,
    ticker,
    company: u.name,
    sector: u.sector,
    question: question || `Research memo on ${ticker}.`,
    asOf: new Date().toISOString().slice(0, 10),
    stance: "mixed",
    confidenceScore: conf,
    confidenceRationale:
      "Confidence is anchored to evidence quality: fundamentals and filing risk-factors are concrete and citable, while forward drivers are described only qualitatively. The self-critique trimmed the score after removing claims that outran the retrieved evidence.",
    thesis: `${u.name} is analyzed here strictly as a research exercise. The retrieved fundamentals and latest 10-K risk factors support a two-sided read: a defensible core business in ${u.sector.toLowerCase()} against identifiable competitive and macro risks. Every substantive claim below is tied to a citation; where the evidence thins out, confidence is lowered rather than the gap being filled with narrative.`,
    keyMetrics: [
      { label: "Revenue (TTM)", value: "see XBRL", trend: "up", commentary: "Pulled from company facts.", citationId: "g1" },
      { label: "Gross margin", value: "see XBRL", trend: "flat", commentary: "Structured from filings.", citationId: "g1" },
      { label: "Free cash flow", value: "see XBRL", trend: "up", commentary: "Funds reinvestment.", citationId: "g1" },
    ],
    risks: [
      { id: "gr1", title: "Competitive intensity", detail: "Item 1A cites competition as a principal risk to pricing and share.", severity: "medium", citationIds: ["g2"] },
      { id: "gr2", title: "Macro / demand sensitivity", detail: "Filing language flags sensitivity of demand to macro conditions.", severity: "medium", citationIds: ["g2"] },
    ],
    catalysts: [
      { id: "gc1", title: "Operating leverage", detail: "MD&A references cost discipline that could expand margins.", likelihood: "medium", horizon: "next 2–3 quarters", citationIds: ["g3"] },
    ],
    citations: [
      { id: "g1", kind: "XBRL", title: `${ticker} company facts (XBRL)`, snippet: "Structured revenue, margin, and cash-flow facts from data.sec.gov.", url: `https://data.sec.gov/api/xbrl/companyfacts/CIK${u.cik}.json`, locator: "us-gaap concepts", filedAt: new Date().toISOString().slice(0, 10) },
      { id: "g2", kind: "10-K", title: `${ticker} 10-K — Item 1A`, snippet: "Competition and macro-demand sensitivity identified as principal risks.", locator: "Item 1A", filedAt: new Date().toISOString().slice(0, 10) },
      { id: "g3", kind: "10-K", title: `${ticker} 10-K — Item 7 (MD&A)`, snippet: "Management discusses cost actions and operating drivers.", locator: "Item 7", filedAt: new Date().toISOString().slice(0, 10) },
    ],
    critique: {
      verdict: "revised",
      supportedClaims: 9,
      totalClaims: 10,
      unsupportedRemoved: [{ claim: "A forward growth claim not present in the evidence.", reason: "No supporting chunk; removed." }],
      contradictions: [],
      confidenceAdjustment: -5,
      notes: "One unsupported forward claim removed; confidence trimmed 5 points. Remaining claims trace to a citation.",
    },
    disclaimer: DISCLAIMER,
    toolCalls: [],
    cost: emptyCost(),
    mode: "demo",
    publishedToTrackRecord: false,
  };
}

function emptyCost(): CostTotals {
  return { tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0, toolCalls: 0, byModel: {} };
}

export function getOrBuildMemo(ticker: string, question: string): Memo {
  const key = ticker.toUpperCase();
  return MEMOS[key] ? structuredClone(MEMOS[key]) : buildGenericMemo(key, question);
}

const PLAN_STEPS = (ticker: string): Plan => ({
  interpretation: `Interpreting the request as a grounded research memo on ${ticker}: establish the quantitative baseline, retrieve the filing narrative (risks + drivers), then check current framing — down-weighted by reliability.`,
  steps: [
    { id: "s1", tool: "get_fundamentals", rationale: "Anchor on hard XBRL facts before any narrative — cheapest, highest-trust source.", query: ticker, parallelGroup: 1 },
    { id: "s2", tool: "search_filings", rationale: "Retrieve Item 1A risk factors + Item 7 MD&A via hybrid RAG for citable claims.", query: "risk factors, competition, margin drivers", parallelGroup: 1 },
    { id: "s3", tool: "get_recent_news", rationale: "Cluster 14-day headlines to catch material framing shifts.", query: `${ticker} last 14d`, dependsOn: ["s1"], parallelGroup: 2 },
  ],
});

const TOOL_DELTAS: Record<ToolName, string[]> = {
  get_fundamentals: [
    "GET data.sec.gov/api/xbrl/companyfacts …",
    "parsed us-gaap:Revenues, GrossProfit, FreeCashFlow",
    "computed 8 derived ratios · 2 citations staged",
  ],
  search_filings: [
    "embedding query · cosine + BM25 hybrid over filing_chunks",
    "retrieved 6 chunks (Item 1A ×4, Item 7 ×2)",
    "reranked · dedup · 3 citations staged",
  ],
  get_recent_news: [
    "fetched 22 headlines (14-day window)",
    "clustered → 4 themes · 2 material",
    "1 citation staged",
  ],
};

function toolTelemetry(tool: ToolName): ToolCallRecord {
  const map: Record<ToolName, Partial<ToolCallRecord>> = {
    get_fundamentals: { latencyMs: 640, resultSummary: "8 XBRL facts + 2 citations", citationsProduced: 2 },
    search_filings: { latencyMs: 1180, resultSummary: "6 chunks · top-3 cited", citationsProduced: 3 },
    get_recent_news: { latencyMs: 540, resultSummary: "22 headlines · 4 themes", citationsProduced: 1 },
  };
  return {
    id: `tc_${tool}`,
    tool,
    args: {},
    status: "success",
    startedAt: new Date().toISOString(),
    latencyMs: 700,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    resultSummary: "",
    citationsProduced: 0,
    ...map[tool],
  };
}

/**
 * The scripted demo pipeline. Yields the same PipelineEvent stream the live
 * orchestrator produces, so the terminal UI is identical in both modes.
 */
export async function* streamDemoPipeline(
  ticker: string,
  question: string,
): AsyncGenerator<PipelineEvent> {
  const memo = getOrBuildMemo(ticker, question);
  const plan = PLAN_STEPS(ticker);

  const totals: CostTotals = { tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0, toolCalls: 0, byModel: {} };
  const addTokens = (model: string, tin: number, tout: number) => {
    totals.tokensIn += tin;
    totals.tokensOut += tout;
    const c = tokenCost(model, tin, tout);
    totals.costUsd += c;
    totals.byModel[model] ??= { tokensIn: 0, tokensOut: 0, costUsd: 0, calls: 0 };
    totals.byModel[model].tokensIn += tin;
    totals.byModel[model].tokensOut += tout;
    totals.byModel[model].costUsd += c;
    totals.byModel[model].calls += 1;
  };

  // ── PLANNING ──────────────────────────────────────────────────────────
  yield { type: "status", phase: "planning", message: "Routing to planner…", ts: now() };
  await sleep(360);
  for (const c of chunks(plan.interpretation, 4)) {
    yield { type: "thinking", phase: "planning", delta: c, ts: now() };
    await sleep(22);
  }
  addTokens(config.models.planner, 2100, 340);
  yield { type: "plan", plan, ts: now() };
  yield { type: "cost", totals: structuredClone(totals), ts: now() };
  await sleep(320);

  // ── RETRIEVING (tools) ─────────────────────────────────────────────────
  yield { type: "status", phase: "retrieving", message: "Executing tool plan (parallel where possible)…", ts: now() };
  for (const step of plan.steps) {
    yield {
      type: "tool_start",
      call: { id: step.id, tool: step.tool, args: { query: step.query }, rationale: step.rationale },
      ts: now(),
    };
    await sleep(160);
    for (const line of TOOL_DELTAS[step.tool]) {
      yield { type: "tool_delta", id: step.id, line, ts: now() };
      await sleep(150);
    }
    const tel = toolTelemetry(step.tool);
    tel.id = step.id;
    totals.toolCalls += 1;
    totals.latencyMs += tel.latencyMs;
    yield { type: "tool_end", call: tel, ts: now() };
    yield { type: "cost", totals: structuredClone(totals), ts: now() };
    await sleep(120);
  }

  // ── SYNTHESIZING ───────────────────────────────────────────────────────
  yield { type: "status", phase: "synthesizing", message: "Synthesizing memo (forced JSON schema)…", ts: now() };
  await sleep(300);
  const synthNarration = `Grounding thesis in ${memo.citations.length} citations. Every metric, risk, and catalyst must map to a source id — unsupported sentences are dropped, not softened. Drafting a two-sided read and setting an initial confidence from evidence quality.`;
  for (const c of chunks(synthNarration, 3)) {
    yield { type: "thinking", phase: "synthesizing", delta: c, ts: now() };
    await sleep(26);
  }
  addTokens(config.models.synth, 12800, 1900);
  const draft: MemoDraft = {
    thesis: memo.thesis,
    stance: memo.stance,
    confidenceScore: Math.min(95, memo.confidenceScore - memo.critique.confidenceAdjustment),
    confidenceRationale: memo.confidenceRationale,
    keyMetrics: memo.keyMetrics,
    risks: memo.risks,
    catalysts: memo.catalysts,
    citations: memo.citations,
  };
  yield { type: "draft", draft, ts: now() };
  yield { type: "cost", totals: structuredClone(totals), ts: now() };
  await sleep(320);

  // ── CRITIQUING ─────────────────────────────────────────────────────────
  yield { type: "status", phase: "critiquing", message: "Self-critique pass (adversarial re-read)…", ts: now() };
  await sleep(280);
  const critNarration = `Re-reading the draft against retrieved evidence only. Checking: does every claim have a live citation? Was any contradicting chunk ignored? Flagging superlatives and forward claims the sources can't support.`;
  for (const c of chunks(critNarration, 3)) {
    yield { type: "thinking", phase: "critiquing", delta: c, ts: now() };
    await sleep(26);
  }
  addTokens(config.models.critic, 4900, 900);
  yield { type: "critique", critique: memo.critique, ts: now() };
  yield { type: "cost", totals: structuredClone(totals), ts: now() };
  await sleep(300);

  // ── FINALIZING (guardrails) ────────────────────────────────────────────
  yield { type: "status", phase: "finalizing", message: "Guardrails · advice-phrasing scrub · disclaimer injection…", ts: now() };
  await sleep(360);

  memo.cost = structuredClone(totals);
  memo.toolCalls = plan.steps.map((s) => {
    const tel = toolTelemetry(s.tool);
    tel.id = s.id;
    tel.args = { query: s.query };
    return tel;
  });
  yield { type: "final", memo, ts: now() };
  yield { type: "done", ts: now() };
}
