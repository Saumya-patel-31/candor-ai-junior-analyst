import { config } from "@/lib/config";
import { getServiceClient } from "@/lib/db/supabase";
import { sleep } from "@/lib/utils";
import type { Memo, PipelineEvent, Plan, ToolName } from "@/lib/types";

/**
 * Memo cache — what makes a public deployment viable on free tiers.
 *
 * Visitors overwhelmingly ask about the same handful of tickers, and a 10-K
 * doesn't change between two clicks. Serving a recent stored memo costs zero
 * tokens and returns instantly, so the daily model budget is spent only on
 * genuinely novel questions.
 */

const DEFAULT_TTL_HOURS = Number(process.env.CANDOR_CACHE_TTL_HOURS ?? 12);

/** Normalize so trivial phrasing differences still hit the same cache entry. */
export function cacheKey(ticker: string, question: string): string {
  const q = question
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${ticker.toUpperCase()}::${q}`;
}

export async function getCachedMemo(
  ticker: string,
  question: string,
  ttlHours = DEFAULT_TTL_HOURS,
): Promise<Memo | null> {
  if (!config.supabase.enabled) return null;
  try {
    const since = new Date(Date.now() - ttlHours * 3600_000).toISOString();
    const { data, error } = await getServiceClient()
      .from("memos")
      .select("payload, created_at")
      .eq("ticker", ticker.toUpperCase())
      .eq("mode", "live")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error || !data?.length) return null;

    const key = cacheKey(ticker, question);
    const hit = data.find((row) => {
      const memo = row.payload as Memo | null;
      return memo && cacheKey(memo.ticker, memo.question) === key;
    });
    return (hit?.payload as Memo) ?? null;
  } catch {
    return null;
  }
}

/**
 * Replay a stored memo through the same event stream a live run produces, so a
 * cache hit looks identical in the terminal — just far faster.
 */
export async function* streamCachedMemo(memo: Memo): AsyncGenerator<PipelineEvent> {
  const now = () => Date.now();
  const cached = { ...memo, publishedToTrackRecord: true };

  yield { type: "status", phase: "planning", message: "Cache hit — replaying stored analysis…", ts: now() };
  await sleep(180);

  const steps = (cached.toolCalls.length ? cached.toolCalls : []).map((tc, i) => ({
    id: tc.id || `s${i + 1}`,
    tool: tc.tool as ToolName,
    rationale: "Recorded during the original run.",
    query: String((tc.args as { query?: string })?.query ?? cached.ticker),
    parallelGroup: 1,
  }));

  const plan: Plan = {
    interpretation: `Serving a cached analysis of ${cached.ticker} generated ${cached.asOf}. Filings don't change between requests, so the stored memo is replayed instead of re-spending the model budget.`,
    steps,
  };
  yield { type: "plan", plan, ts: now() };
  await sleep(160);

  yield { type: "status", phase: "retrieving", message: "Restoring recorded tool results…", ts: now() };
  for (const tc of cached.toolCalls) {
    yield { type: "tool_start", call: { id: tc.id, tool: tc.tool, args: tc.args, rationale: "cached" }, ts: now() };
    await sleep(90);
    yield { type: "tool_end", call: tc, ts: now() };
  }

  yield { type: "status", phase: "synthesizing", message: "Loading synthesized memo…", ts: now() };
  await sleep(160);
  yield {
    type: "draft",
    draft: {
      thesis: cached.thesis,
      stance: cached.stance,
      confidenceScore: cached.confidenceScore,
      confidenceRationale: cached.confidenceRationale,
      keyMetrics: cached.keyMetrics,
      risks: cached.risks,
      catalysts: cached.catalysts,
      citations: cached.citations,
    },
    ts: now(),
  };

  yield { type: "status", phase: "critiquing", message: "Loading self-critique…", ts: now() };
  await sleep(140);
  yield { type: "critique", critique: cached.critique, ts: now() };

  // A replay spends nothing — report zeroed cost so the dashboard stays truthful.
  yield {
    type: "cost",
    totals: { tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0, toolCalls: cached.toolCalls.length, byModel: {} },
    ts: now(),
  };

  yield { type: "status", phase: "finalizing", message: "Cached result — no model spend.", ts: now() };
  await sleep(120);
  yield { type: "final", memo: cached, ts: now() };
  yield { type: "done", ts: now() };
}
