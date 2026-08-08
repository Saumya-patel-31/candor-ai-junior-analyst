import { DISCLAIMER, UNIVERSE } from "@/lib/config";
import { clamp } from "@/lib/utils";
import type { Citation, Critique, MemoDraft, Memo, CostTotals, ToolCallRecord } from "@/lib/types";

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

/* ── Citation support verification ────────────────────────────────────────
   Integrity says the citation EXISTS. Support says it actually backs the claim.
   Models paraphrase away from their source, so we check lexical grounding: if a
   claim doesn't overlap its cited snippet, try to re-attach it to a citation that
   does, and drop it when nothing supports it. This enforces the product's core
   promise rather than trusting the model to have honoured it. */

const STOPWORDS = new Set(
  ("the a an and or of to in on for with is are was were be as by at from that this it its their our we you " +
    "has have had will would could may might can not no more most other such which than then these those").split(" "),
);

function contentTokens(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

/** Fraction of the claim's content words that appear in the source snippet. */
function supportScore(claim: string, snippet: string): number {
  const c = contentTokens(claim);
  if (!c.size) return 1;
  const s = contentTokens(snippet);
  let hit = 0;
  for (const w of c) if (s.has(w)) hit++;
  return hit / c.size;
}

const SUPPORT_THRESHOLD = 0.16;

function bestCitationFor(claim: string, citations: Citation[]): { id: string; score: number } | null {
  let best: { id: string; score: number } | null = null;
  for (const c of citations) {
    const score = supportScore(claim, `${c.title} ${c.snippet}`);
    if (!best || score > best.score) best = { id: c.id, score };
  }
  return best;
}

export function verifyCitationSupport(draft: MemoDraft): {
  draft: MemoDraft;
  dropped: { claim: string; reason: string }[];
  reattached: number;
} {
  const byId = new Map(draft.citations.map((c) => [c.id, c]));
  const dropped: { claim: string; reason: string }[] = [];
  let reattached = 0;

  const check = <T extends { title: string; detail: string; citationIds: string[] }>(items: T[]): T[] =>
    items
      .map((item) => {
        const claim = `${item.title}. ${item.detail}`;
        const supported = item.citationIds.filter((id) => {
          const c = byId.get(id);
          return c && supportScore(claim, `${c.title} ${c.snippet}`) >= SUPPORT_THRESHOLD;
        });
        if (supported.length) return { ...item, citationIds: supported };

        // Cited source doesn't back the claim — is there one that does?
        const best = bestCitationFor(claim, draft.citations);
        if (best && best.score >= SUPPORT_THRESHOLD) {
          reattached += 1;
          return { ...item, citationIds: [best.id] };
        }
        return { ...item, citationIds: [] };
      })
      .filter((item) => {
        if (item.citationIds.length === 0) {
          dropped.push({
            claim: item.title,
            reason: "No retrieved source supports this claim — removed by the support check.",
          });
          return false;
        }
        return true;
      });

  return { draft: { ...draft, risks: check(draft.risks), catalysts: check(draft.catalysts) }, dropped, reattached };
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

  // Hard accuracy gates, in order: (1) the citation must exist, (2) it must
  // actually support the claim.
  const integrity = enforceCitationIntegrity(args.draft);
  const support = verifyCitationSupport(integrity.draft);
  const draft = support.draft;
  const strippedRefs = integrity.strippedRefs;
  const droppedClaims = [...integrity.droppedClaims, ...support.dropped];

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
