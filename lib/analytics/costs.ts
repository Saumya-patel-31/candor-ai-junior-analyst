import { config } from "@/lib/config";
import { getServiceClient } from "@/lib/db/supabase";
import { DEMO_COST_RECORDS } from "@/lib/demo/mockCosts";

export interface CostRecord {
  id: string;
  ticker: string;
  createdAt: string; // ISO
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  byModel: { model: string; tokensIn: number; tokensOut: number; costUsd: number; calls: number }[];
  toolLatencies: { tool: string; latencyMs: number }[];
}

export interface CostSummary {
  memoCount: number;
  totalSpend: number;
  avgCostPerMemo: number;
  totalTokens: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  byModel: { model: string; calls: number; tokensIn: number; tokensOut: number; costUsd: number }[];
  byTool: { tool: string; calls: number; avgLatencyMs: number }[];
  spendSeries: { date: string; costUsd: number; memos: number }[];
  latencyBuckets: { bucket: string; count: number }[];
  live: boolean;
}

const LAT_BUCKETS: [string, number, number][] = [
  ["<5s", 0, 5000],
  ["5–7s", 5000, 7000],
  ["7–9s", 7000, 9000],
  ["9–12s", 9000, 12000],
  [">12s", 12000, Infinity],
];

export function aggregate(records: CostRecord[], live: boolean): CostSummary {
  const memoCount = records.length;
  const totalSpend = records.reduce((s, r) => s + r.costUsd, 0);
  const totalTokens = records.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0);
  const latencies = records.map((r) => r.latencyMs).sort((a, b) => a - b);
  const avgLatencyMs = memoCount ? latencies.reduce((s, v) => s + v, 0) / memoCount : 0;
  const p95LatencyMs = latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] : 0;

  const modelMap = new Map<string, { calls: number; tokensIn: number; tokensOut: number; costUsd: number }>();
  for (const r of records) {
    for (const m of r.byModel) {
      const e = modelMap.get(m.model) ?? { calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
      e.calls += m.calls;
      e.tokensIn += m.tokensIn;
      e.tokensOut += m.tokensOut;
      e.costUsd += m.costUsd;
      modelMap.set(m.model, e);
    }
  }

  const toolMap = new Map<string, { total: number; count: number }>();
  for (const r of records) {
    for (const t of r.toolLatencies) {
      const e = toolMap.get(t.tool) ?? { total: 0, count: 0 };
      e.total += t.latencyMs;
      e.count += 1;
      toolMap.set(t.tool, e);
    }
  }

  const dayMap = new Map<string, { costUsd: number; memos: number }>();
  for (const r of records) {
    const day = r.createdAt.slice(0, 10);
    const e = dayMap.get(day) ?? { costUsd: 0, memos: 0 };
    e.costUsd += r.costUsd;
    e.memos += 1;
    dayMap.set(day, e);
  }

  const latencyBuckets = LAT_BUCKETS.map(([bucket, lo, hi]) => ({
    bucket,
    count: records.filter((r) => r.latencyMs >= lo && r.latencyMs < hi).length,
  }));

  return {
    memoCount,
    totalSpend,
    avgCostPerMemo: memoCount ? totalSpend / memoCount : 0,
    totalTokens,
    avgLatencyMs,
    p95LatencyMs,
    byModel: [...modelMap.entries()].map(([model, v]) => ({ model, ...v })).sort((a, b) => b.costUsd - a.costUsd),
    byTool: [...toolMap.entries()].map(([tool, v]) => ({ tool, calls: v.count, avgLatencyMs: v.total / v.count })),
    spendSeries: [...dayMap.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-30),
    latencyBuckets,
    live,
  };
}

/** Real cost data from Supabase when configured; otherwise the demo history. */
export async function getCostSummary(): Promise<CostSummary> {
  if (!config.supabase.enabled) return aggregate(DEMO_COST_RECORDS, false);
  try {
    const supabase = getServiceClient();
    const { data: memos } = await supabase
      .from("memos")
      .select("id, ticker, created_at, cost_usd, tokens_in, tokens_out, latency_ms, payload")
      .order("created_at", { ascending: false })
      .limit(500);
    const { data: calls } = await supabase.from("tool_calls").select("memo_id, tool, latency_ms");
    const toolsByMemo = new Map<string, { tool: string; latencyMs: number }[]>();
    for (const c of calls ?? []) {
      const arr = toolsByMemo.get(c.memo_id) ?? [];
      arr.push({ tool: c.tool, latencyMs: c.latency_ms ?? 0 });
      toolsByMemo.set(c.memo_id, arr);
    }
    const records: CostRecord[] = (memos ?? []).map((m) => ({
      id: m.id,
      ticker: m.ticker,
      createdAt: m.created_at,
      costUsd: Number(m.cost_usd ?? 0),
      tokensIn: m.tokens_in ?? 0,
      tokensOut: m.tokens_out ?? 0,
      latencyMs: m.latency_ms ?? 0,
      byModel: Object.entries((m.payload?.cost?.byModel ?? {}) as Record<string, { tokensIn: number; tokensOut: number; costUsd: number; calls: number }>).map(
        ([model, v]) => ({ model, ...v }),
      ),
      toolLatencies: toolsByMemo.get(m.id) ?? [],
    }));
    return aggregate(records, true);
  } catch {
    return aggregate(DEMO_COST_RECORDS, false);
  }
}
