import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import type { Memo, ToolCallRecord } from "@/lib/types";

let service: SupabaseClient | null = null;

/** Server-only client using the service-role key. NEVER import into client code. */
export function getServiceClient(): SupabaseClient {
  if (!config.supabase.enabled) throw new Error("Supabase is not configured");
  if (!service) {
    service = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false },
    });
  }
  return service;
}

/** Persist a finished memo + its tool-call telemetry (best-effort). */
export async function persistMemo(memo: Memo): Promise<void> {
  if (!config.supabase.enabled) return;
  const supabase = getServiceClient();
  await supabase.from("memos").insert({
    id: memo.id,
    ticker: memo.ticker,
    company: memo.company,
    question: memo.question,
    as_of: memo.asOf,
    stance: memo.stance,
    confidence_score: memo.confidenceScore,
    thesis: memo.thesis,
    payload: memo,
    cost_usd: memo.cost.costUsd,
    latency_ms: memo.cost.latencyMs,
    tokens_in: memo.cost.tokensIn,
    tokens_out: memo.cost.tokensOut,
    mode: memo.mode,
  });
  if (memo.toolCalls.length) {
    await supabase.from("tool_calls").insert(
      memo.toolCalls.map((tc: ToolCallRecord) => ({
        memo_id: memo.id,
        tool: tc.tool,
        args: tc.args,
        status: tc.status,
        latency_ms: tc.latencyMs,
        tokens_in: tc.tokensIn,
        tokens_out: tc.tokensOut,
        cost_usd: tc.costUsd,
        result_summary: tc.resultSummary,
      })),
    );
  }
}
