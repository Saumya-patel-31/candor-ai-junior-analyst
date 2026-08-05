import { config, UNIVERSE } from "@/lib/config";
import type { CostRecord } from "@/lib/analytics/costs";

/* Deterministic demo cost/latency history so the ops dashboard is rich without a DB. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x005a1e);
const TICKERS = Object.keys(UNIVERSE);
const TOOLS = ["get_fundamentals", "search_filings", "get_recent_news"];

function build(): CostRecord[] {
  const out: CostRecord[] = [];
  const N = 68;
  for (let i = 0; i < N; i++) {
    const ticker = TICKERS[Math.floor(rand() * TICKERS.length)];
    const daysAgo = Math.floor((i / N) * 30) + Math.floor(rand() * 2);
    const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
    const smallIn = 1800 + Math.floor(rand() * 900);
    const smallOut = 260 + Math.floor(rand() * 220);
    const bigIn = 15500 + Math.floor(rand() * 5200);
    const bigOut = 2100 + Math.floor(rand() * 1600);
    // Reference cost at provider list rates (on the free tier, actual = $0).
    const smallCost = (smallIn / 1e6) * 0.05 + (smallOut / 1e6) * 0.08;
    const bigCost = (bigIn / 1e6) * 0.59 + (bigOut / 1e6) * 0.79;
    out.push({
      id: `demo_${i}`,
      ticker,
      createdAt,
      costUsd: Number((smallCost + bigCost).toFixed(5)),
      tokensIn: smallIn + bigIn,
      tokensOut: smallOut + bigOut,
      latencyMs: 6000 + Math.floor(rand() * 4200),
      byModel: [
        { model: config.models.planner, tokensIn: smallIn, tokensOut: smallOut, costUsd: Number(smallCost.toFixed(5)), calls: 2 },
        { model: config.models.synth, tokensIn: bigIn, tokensOut: bigOut, costUsd: Number(bigCost.toFixed(5)), calls: 2 },
      ],
      toolLatencies: TOOLS.map((tool) => ({
        tool,
        latencyMs:
          tool === "search_filings" ? 950 + Math.floor(rand() * 500) : 450 + Math.floor(rand() * 400),
      })),
    });
  }
  return out;
}

export const DEMO_COST_RECORDS: CostRecord[] = build();
