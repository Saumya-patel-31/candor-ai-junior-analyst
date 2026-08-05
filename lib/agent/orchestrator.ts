import type {
  CostTotals,
  PipelineEvent,
  PlanStep,
  ToolCallRecord,
} from "@/lib/types";
import { executeTool, type ToolResult } from "@/lib/tools";
import type { CallUsage } from "./llm";
import { plan } from "./planner";
import { synthesize } from "./synthesizer";
import { critique } from "./critic";
import { applyGuardrails } from "./guardrails";
import { persistMemo } from "@/lib/db/supabase";
import { recordPrediction } from "@/lib/calibration/store";

const now = () => Date.now();

function newTotals(): CostTotals {
  return { tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0, toolCalls: 0, byModel: {} };
}
function addUsage(totals: CostTotals, u: CallUsage) {
  totals.tokensIn += u.tokensIn;
  totals.tokensOut += u.tokensOut;
  totals.costUsd += u.costUsd;
  totals.latencyMs += u.latencyMs;
  totals.byModel[u.model] ??= { tokensIn: 0, tokensOut: 0, costUsd: 0, calls: 0 };
  const m = totals.byModel[u.model];
  m.tokensIn += u.tokensIn;
  m.tokensOut += u.tokensOut;
  m.costUsd += u.costUsd;
  m.calls += 1;
}

/**
 * The live agent loop: plan → execute tools (parallel by group) → synthesize →
 * self-critique → guardrails. Emits the SAME PipelineEvent stream as the demo,
 * so the terminal UI is mode-agnostic.
 */
export async function* runLivePipeline(
  ticker: string,
  question: string,
): AsyncGenerator<PipelineEvent> {
  const totals = newTotals();

  // ── PLANNING ───────────────────────────────────────────────────────────
  yield { type: "status", phase: "planning", message: "Routing to planner…", ts: now() };
  const { plan: thePlan, usage: planUsage } = await plan(ticker, question);
  addUsage(totals, planUsage);
  yield { type: "thinking", phase: "planning", delta: thePlan.interpretation, ts: now() };
  yield { type: "plan", plan: thePlan, ts: now() };
  yield { type: "cost", totals: structuredClone(totals), ts: now() };

  // ── RETRIEVING (parallel by group) ─────────────────────────────────────
  yield { type: "status", phase: "retrieving", message: "Executing tool plan…", ts: now() };
  const groups = new Map<number, PlanStep[]>();
  thePlan.steps.forEach((s, i) => {
    const g = s.parallelGroup ?? i;
    groups.set(g, [...(groups.get(g) ?? []), s]);
  });

  const results: ToolResult[] = [];
  const toolRecords: ToolCallRecord[] = [];

  for (const group of [...groups.keys()].sort((a, b) => a - b)) {
    const steps = groups.get(group)!;
    for (const step of steps) {
      yield {
        type: "tool_start",
        call: { id: step.id, tool: step.tool, args: { query: step.query }, rationale: step.rationale },
        ts: now(),
      };
    }
    const settled = await Promise.all(
      steps.map(async (step) => ({ step, result: await executeTool(step.tool, { ticker, query: step.query }) })),
    );
    for (const { step, result } of settled) {
      results.push(result);
      const rec: ToolCallRecord = {
        id: step.id,
        tool: step.tool,
        args: { query: step.query },
        status: result.ok ? "success" : "error",
        startedAt: new Date().toISOString(),
        latencyMs: result.latencyMs,
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        resultSummary: result.summary.slice(0, 200),
        citationsProduced: result.citations.length,
      };
      toolRecords.push(rec);
      totals.toolCalls += 1;
      totals.latencyMs += result.latencyMs;
      yield { type: "tool_end", call: rec, ts: now() };
    }
    yield { type: "cost", totals: structuredClone(totals), ts: now() };
  }

  // ── SYNTHESIZING ───────────────────────────────────────────────────────
  yield { type: "status", phase: "synthesizing", message: "Synthesizing memo (forced JSON)…", ts: now() };
  const { draft, usage: synthUsage } = await synthesize(ticker, question, results);
  addUsage(totals, synthUsage);
  yield { type: "draft", draft, ts: now() };
  yield { type: "cost", totals: structuredClone(totals), ts: now() };

  // ── CRITIQUING ─────────────────────────────────────────────────────────
  yield { type: "status", phase: "critiquing", message: "Self-critique pass…", ts: now() };
  const { critique: crit, usage: critUsage } = await critique(draft, results);
  addUsage(totals, critUsage);
  yield { type: "critique", critique: crit, ts: now() };
  yield { type: "cost", totals: structuredClone(totals), ts: now() };

  // ── FINALIZING (guardrails) ────────────────────────────────────────────
  yield { type: "status", phase: "finalizing", message: "Guardrails · disclaimer injection…", ts: now() };
  const memo = applyGuardrails({
    ticker,
    question,
    draft,
    critique: crit,
    cost: structuredClone(totals),
    toolCalls: toolRecords,
    mode: "live",
  });

  persistMemo(memo).catch((e) => console.error("persistMemo failed:", e));
  recordPrediction(memo).catch((e) => console.error("recordPrediction failed:", e));

  yield { type: "final", memo, ts: now() };
  yield { type: "done", ts: now() };
}
