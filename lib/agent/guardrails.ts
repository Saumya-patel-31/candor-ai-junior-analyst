import { DISCLAIMER, UNIVERSE } from "@/lib/config";
import { clamp } from "@/lib/utils";
import type { Critique, MemoDraft, Memo, CostTotals, ToolCallRecord } from "@/lib/types";

/** Phrases that would turn research into personalized advice. */
const ADVICE_PATTERNS: { re: RegExp; replace: string }[] = [
  { re: /\byou should (buy|sell|hold|short)\b/gi, replace: "an investor might analyze" },
  { re: /\b(i|we) recommend (buying|selling|shorting|holding)\b/gi, replace: "the evidence describes" },
  { re: /\bmy (price )?target\b/gi, replace: "a scenario reference" },
  { re: /\bstrong (buy|sell)\b/gi, replace: "notable signal" },
  { re: /\ballocate \d+%/gi, replace: "consider position context" },
];

export function scrubAdvice(text: string): { text: string; triggered: boolean } {
  let triggered = false;
  let out = text;
  for (const { re, replace } of ADVICE_PATTERNS) {
    if (re.test(out)) {
      triggered = true;
      out = out.replace(re, replace);
    }
  }
  return { text: out, triggered };
}

/** Pre-flight: refuse questions that ask for personalized advice. */
export function checkQuestionAllowed(question: string): { allowed: boolean; reason?: string } {
  const q = question.toLowerCase();
  const banned = [
    /should i (buy|sell|hold|short)/,
    /(my|our) (portfolio|holdings|position)/,
    /how much should i (buy|invest|put)/,
    /is it a good time to (buy|sell)/,
    /(price target|pt) for/,
  ];
  for (const re of banned) {
    if (re.test(q)) {
      return {
        allowed: false,
        reason:
          "Candor is a research/education tool, not a licensed adviser — it can't give personalized buy/sell/hold or portfolio guidance. Try a neutral research question instead, e.g. \"research memo on <TICKER>\" or \"how exposed is <TICKER> to <risk>\".",
      };
    }
  }
  return { allowed: true };
}

/**
 * Citation referential integrity.
 *
 * The product promise is "every claim traces to a real source", so a citation id
 * the model invented must not survive into a published memo. Any reference that
 * doesn't resolve to a retrieved citation is stripped; a claim left with NO valid
 * citation is dropped entirely (evidence-grounded or gone).
 */
export function enforceCitationIntegrity(draft: MemoDraft): {
  draft: MemoDraft;
  droppedClaims: { claim: string; reason: string }[];
  strippedRefs: number;
} {
  const valid = new Set(draft.citations.map((c) => c.id));
  const dropped: { claim: string; reason: string }[] = [];
  let stripped = 0;

  const clean = (ids: string[]) => {
    const kept = ids.filter((id) => valid.has(id));
    stripped += ids.length - kept.length;
    return kept;
  };

  const risks = draft.risks
    .map((r) => ({ ...r, citationIds: clean(r.citationIds) }))
    .filter((r) => {
      if (r.citationIds.length === 0) {
        dropped.push({ claim: r.title, reason: "Risk cited no valid source after integrity check — removed." });
        return false;
      }
      return true;
    });

  const catalysts = draft.catalysts
    .map((c) => ({ ...c, citationIds: clean(c.citationIds) }))
    .filter((c) => {
      if (c.citationIds.length === 0) {
        dropped.push({ claim: c.title, reason: "Catalyst cited no valid source after integrity check — removed." });
        return false;
      }
      return true;
    });

  // Metrics keep their value (they're quantitative and traceable to the evidence
  // bundle) but an invented citationId is cleared rather than shown as real.
  const keyMetrics = draft.keyMetrics.map((m) => {
    if (m.citationId && !valid.has(m.citationId)) {
      stripped += 1;
      return { ...m, citationId: undefined };
    }
    return m;
  });

  return { draft: { ...draft, risks, catalysts, keyMetrics }, droppedClaims: dropped, strippedRefs: stripped };
}

/** Turn a draft + critique into the final, guardrailed, publishable memo. */
export function applyGuardrails(args: {
  ticker: string;
  question: string;
  draft: MemoDraft;
  critique: Critique;
  cost: CostTotals;
  toolCalls: ToolCallRecord[];
  mode: "demo" | "live";
}): Memo {
  const { ticker, question, critique, cost, toolCalls, mode } = args;
  const u = UNIVERSE[ticker.toUpperCase()] ?? { name: `${ticker} Inc.`, sector: "Equity", cik: "" };

  // Hard accuracy gate: strip invented citation ids, drop uncited claims.
  const { draft, droppedClaims, strippedRefs } = enforceCitationIntegrity(args.draft);

  const thesis = scrubAdvice(draft.thesis).text;
  const confidenceRationale = scrubAdvice(draft.confidenceRationale).text;
  const finalConfidence = clamp(
    Math.round(draft.confidenceScore + critique.confidenceAdjustment),
    1,
    99,
  );

  // Surface integrity removals in the critique so the memo stays honest about them.
  const finalCritique: Critique = droppedClaims.length
    ? {
        ...critique,
        verdict: critique.verdict === "passed" ? "revised" : critique.verdict,
        unsupportedRemoved: [...critique.unsupportedRemoved, ...droppedClaims],
        notes:
          `${critique.notes} Citation-integrity check removed ${droppedClaims.length} claim(s) whose sources did not resolve` +
          (strippedRefs ? `, and stripped ${strippedRefs} invalid citation reference(s).` : "."),
      }
    : critique;

  return {
    id: `memo_${ticker.toLowerCase()}_${Date.now().toString(36)}`,
    ticker: ticker.toUpperCase(),
    company: u.name,
    sector: u.sector,
    question,
    asOf: new Date().toISOString().slice(0, 10),
    thesis,
    stance: draft.stance,
    confidenceScore: finalConfidence,
    confidenceRationale,
    keyMetrics: draft.keyMetrics,
    risks: draft.risks,
    catalysts: draft.catalysts,
    citations: draft.citations,
    critique: finalCritique,
    disclaimer: DISCLAIMER,
    toolCalls,
    cost,
    mode,
    publishedToTrackRecord: false,
  };
}
