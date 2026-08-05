import { config, UNIVERSE } from "@/lib/config";
import { getServiceClient } from "@/lib/db/supabase";
import { getReturn, getBenchmarkReturn, marketConfigured } from "@/lib/data/market";
import { computeSummary, scoreOutcome } from "@/lib/calibration/scoring";
import { CALIBRATION_RECORDS, CALIBRATION_SUMMARY } from "@/lib/demo/mockCalibration";
import type { CalibrationRecord, CalibrationSummary, Memo } from "@/lib/types";

export function calibrationEnabled(): boolean {
  return config.supabase.enabled;
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86400000).toISOString().slice(0, 10);
}

/** Log a prediction at memo time so it can be scored later. Best-effort. */
export async function recordPrediction(memo: Memo): Promise<void> {
  if (!calibrationEnabled()) return;
  try {
    await getServiceClient().from("calibration_scores").insert({
      memo_id: memo.id,
      ticker: memo.ticker,
      question: memo.question,
      stance: memo.stance,
      confidence_score: memo.confidenceScore,
      as_of: memo.asOf,
      horizon_days: 90,
      resolved: false,
    });
  } catch (e) {
    console.error("recordPrediction failed:", e);
  }
}

export async function listCalibrationRecords(): Promise<CalibrationRecord[]> {
  if (!calibrationEnabled()) return CALIBRATION_RECORDS;
  try {
    const { data, error } = await getServiceClient()
      .from("calibration_scores")
      .select("*")
      .order("as_of", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      memoId: r.memo_id,
      ticker: r.ticker,
      company: UNIVERSE[r.ticker]?.name ?? r.ticker,
      question: r.question ?? "Research memo",
      confidenceScore: r.confidence_score,
      stance: r.stance ?? "neutral",
      asOf: r.as_of,
      horizonDays: r.horizon_days ?? 90,
      resolved: r.resolved,
      correct: r.correct ?? undefined,
      resolvedAt: r.resolved_at ?? undefined,
      note: r.note ?? undefined,
    }));
  } catch (e) {
    console.error("listCalibrationRecords fell back to demo:", e);
    return CALIBRATION_RECORDS;
  }
}

export async function getCalibrationSummary(): Promise<CalibrationSummary> {
  if (!calibrationEnabled()) return CALIBRATION_SUMMARY;
  const records = await listCalibrationRecords();
  return computeSummary(records);
}

export interface ResolveResult {
  enabled: boolean;
  marketReady: boolean;
  scanned: number;
  resolved: number;
  details: { ticker: string; stance: string; confidence: number; correct: boolean; assetReturn: number; benchmarkReturn: number }[];
  message?: string;
}

/**
 * The resolution job. Finds predictions whose horizon has elapsed, fetches the
 * realized return over the horizon, scores the directional read, and writes the
 * outcome. Idempotent — only touches unresolved rows past their horizon.
 * Designed to be called by a scheduler (see app/api/cron/resolve).
 */
export async function resolveDueMemos(now = new Date()): Promise<ResolveResult> {
  if (!calibrationEnabled()) {
    return { enabled: false, marketReady: false, scanned: 0, resolved: 0, details: [], message: "Supabase not configured — running in demo mode." };
  }
  if (!marketConfigured()) {
    return { enabled: true, marketReady: false, scanned: 0, resolved: 0, details: [], message: "No market-data key (ALPHAVANTAGE_API_KEY / FINNHUB_API_KEY)." };
  }

  const supabase = getServiceClient();
  const today = now.toISOString().slice(0, 10);
  const { data, error } = await supabase.from("calibration_scores").select("*").eq("resolved", false);
  if (error) throw new Error(error.message);

  const due = (data ?? []).filter((r) => addDays(r.as_of, r.horizon_days ?? 90) <= today);
  const details: ResolveResult["details"] = [];

  for (const r of due) {
    const to = addDays(r.as_of, r.horizon_days ?? 90);
    let assetReturn: number | null = null;
    try {
      assetReturn = await getReturn(r.ticker, r.as_of, to);
    } catch {
      assetReturn = null;
    }
    if (assetReturn == null) continue; // data gap — leave unresolved, retry next run
    const benchmarkReturn = await getBenchmarkReturn(r.as_of, to);
    const correct = scoreOutcome(r.stance ?? "neutral", assetReturn, benchmarkReturn);

    await supabase
      .from("calibration_scores")
      .update({
        resolved: true,
        correct,
        observed_return: Number(assetReturn.toFixed(4)),
        benchmark_return: Number(benchmarkReturn.toFixed(4)),
        resolved_at: today,
        note: correct ? "Directional read held over horizon." : "Directional read did not hold.",
      })
      .eq("id", r.id);

    details.push({ ticker: r.ticker, stance: r.stance ?? "neutral", confidence: r.confidence_score, correct, assetReturn, benchmarkReturn });
  }

  return { enabled: true, marketReady: true, scanned: due.length, resolved: details.length, details };
}
