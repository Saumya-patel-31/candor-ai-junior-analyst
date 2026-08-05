import type { CalibrationRecord, CalibrationSummary, MemoDraft, ReliabilityBin } from "@/lib/types";

/**
 * Calibration scoring — the honest core shared by the real (Supabase) and demo paths.
 *
 * What we're measuring: whether the model's CONFIDENCE is well-calibrated — i.e. do
 * its 70%-confidence calls actually resolve correct ~70% of the time. This is a
 * model-evaluation question, NOT a trade P&L and NOT advice.
 *
 * How a memo's directional READ is scored against realized return over its horizon:
 *   constructive → correct if the name outperformed its benchmark (rel return > 0)
 *   cautious     → correct if it underperformed (rel return < 0)
 *   mixed/neutral→ correct if it stayed range-bound (|rel return| ≤ NEUTRAL_BAND)
 * Returns are benchmark-relative where a benchmark is available, absolute otherwise.
 */

export type Stance = MemoDraft["stance"];

export const DEFAULT_HORIZON_DAYS = 90;
export const NEUTRAL_BAND = 0.03; // ±3% relative return counts as "no strong direction"

export function scoreOutcome(
  stance: Stance,
  assetReturn: number,
  benchmarkReturn = 0,
  band = NEUTRAL_BAND,
): boolean {
  const rel = assetReturn - benchmarkReturn;
  switch (stance) {
    case "constructive":
      return rel > 0;
    case "cautious":
      return rel < 0;
    case "mixed":
    case "neutral":
    default:
      return Math.abs(rel) <= band;
  }
}

export function describeStanceHypothesis(stance: Stance): string {
  switch (stance) {
    case "constructive":
      return "expects the name to outperform its benchmark over the horizon";
    case "cautious":
      return "expects the name to underperform / carry elevated downside";
    case "mixed":
    case "neutral":
    default:
      return "expects no strong directional move (range-bound vs. benchmark)";
  }
}

const p = (r: CalibrationRecord) => r.confidenceScore / 100;
const isResolved = (r: CalibrationRecord) => r.resolved && r.correct !== undefined;

export function brierScore(records: CalibrationRecord[]): number {
  const res = records.filter(isResolved);
  if (!res.length) return 0;
  return res.reduce((s, r) => s + (p(r) - (r.correct ? 1 : 0)) ** 2, 0) / res.length;
}

export function reliabilityBins(records: CalibrationRecord[]): ReliabilityBin[] {
  const res = records.filter(isResolved);
  const edges = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.95];
  const bins: ReliabilityBin[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const [lo, hi] = [edges[i], edges[i + 1]];
    const inBin = res.filter((r) => p(r) >= lo && p(r) < hi);
    if (!inBin.length) continue;
    bins.push({
      bucket: `${Math.round(lo * 100)}–${Math.round(hi * 100)}`,
      midpoint: (lo + hi) / 2,
      predicted: inBin.reduce((s, r) => s + p(r), 0) / inBin.length,
      observed: inBin.filter((r) => r.correct).length / inBin.length,
      count: inBin.length,
    });
  }
  return bins;
}

/** Expected Calibration Error — weighted gap between confidence and hit-rate. */
export function expectedCalibrationError(records: CalibrationRecord[]): number {
  const res = records.filter(isResolved);
  if (!res.length) return 0;
  const bins = reliabilityBins(records);
  return bins.reduce((s, b) => s + (b.count / res.length) * Math.abs(b.predicted - b.observed), 0);
}

/** Cumulative ECE/Brier by month — the "eval harness is tightening" trend. */
function computeTrend(records: CalibrationRecord[]): CalibrationSummary["trend"] {
  const res = records
    .filter(isResolved)
    .sort((a, b) => ((a.resolvedAt ?? a.asOf) < (b.resolvedAt ?? b.asOf) ? -1 : 1));
  if (!res.length) return [];
  const months = Array.from(new Set(res.map((r) => (r.resolvedAt ?? r.asOf).slice(0, 7)))).sort();
  return months.slice(-6).map((m) => {
    const upTo = res.filter((r) => (r.resolvedAt ?? r.asOf).slice(0, 7) <= m);
    return {
      date: m,
      ece: Number(expectedCalibrationError(upTo).toFixed(3)),
      brier: Number(brierScore(upTo).toFixed(3)),
      resolved: upTo.length,
    };
  });
}

export function computeSummary(records: CalibrationRecord[]): CalibrationSummary {
  const res = records.filter(isResolved);
  const meanP = res.length ? res.reduce((s, r) => s + p(r), 0) / res.length : 0;
  const meanAcc = res.length ? res.filter((r) => r.correct).length / res.length : 0;
  return {
    totalMemos: records.length,
    resolved: res.length,
    brierScore: Number(brierScore(records).toFixed(3)),
    ece: Number(expectedCalibrationError(records).toFixed(3)),
    overconfidence: Number((meanP - meanAcc).toFixed(3)),
    bins: reliabilityBins(records),
    trend: computeTrend(records),
  };
}
