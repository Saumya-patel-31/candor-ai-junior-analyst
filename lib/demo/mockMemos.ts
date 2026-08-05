import { config, DISCLAIMER } from "@/lib/config";
import type { Memo, CostTotals, ToolCallRecord } from "@/lib/types";

/* Illustrative telemetry so the cost/latency surfaces have real texture.
   Numbers: a 3-tool run — fast model plans, larger model synthesizes/critiques. */
function cost(partial?: Partial<CostTotals>): CostTotals {
  return {
    tokensIn: 21840,
    tokensOut: 3120,
    costUsd: 0.0127,
    latencyMs: 7420,
    toolCalls: 3,
    byModel: {
      [config.models.planner]: { tokensIn: 4120, tokensOut: 640, costUsd: 0.00026, calls: 2 },
      [config.models.synth]: { tokensIn: 17720, tokensOut: 2480, costUsd: 0.01241, calls: 2 },
    },
    ...partial,
  };
}

function toolCalls(ticker: string): ToolCallRecord[] {
  const t = new Date("2026-07-16T14:02:00Z").getTime();
  return [
    {
      id: "tc_fund",
      tool: "get_fundamentals",
      args: { ticker },
      status: "success",
      startedAt: new Date(t).toISOString(),
      latencyMs: 640,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      resultSummary: "8 XBRL facts: revenue, gross margin, op margin, FCF, net debt, R&D.",
      citationsProduced: 2,
    },
    {
      id: "tc_filings",
      tool: "search_filings",
      args: { ticker, query: "risk factors, competition, MD&A drivers" },
      status: "success",
      startedAt: new Date(t + 700).toISOString(),
      latencyMs: 1180,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      resultSummary: "Top-6 chunks from latest 10-K (Item 1A + Item 7) via hybrid RAG.",
      citationsProduced: 3,
    },
    {
      id: "tc_news",
      tool: "get_recent_news",
      args: { ticker, lookbackDays: 14 },
      status: "success",
      startedAt: new Date(t + 720).toISOString(),
      latencyMs: 540,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      resultSummary: "22 headlines clustered into 4 themes; 2 material.",
      citationsProduced: 1,
    },
  ];
}

export const MEMOS: Record<string, Memo> = {
  NVDA: {
    id: "memo_nvda_2026q2",
    ticker: "NVDA",
    company: "NVIDIA Corporation",
    sector: "Semiconductors",
    question: "Give me a research memo on NVDA.",
    asOf: "2026-07-16",
    stance: "constructive",
    confidenceScore: 74,
    confidenceRationale:
      "Data-center demand and pricing power are exceptionally well-documented in filings and fundamentals (high-quality evidence). The discount to full conviction reflects two structurally unresolvable unknowns: the durability of hyperscaler capex at current intensity, and binary regulatory risk on China export controls. Confidence was trimmed 8 points by the self-critique after it flagged that supply-concentration risk had been under-weighted in the first draft.",
    thesis:
      "NVIDIA remains the reference platform for accelerated computing, and the moat is now as much software (CUDA, networking, systems) as silicon. Fundamentals show demand outrunning supply with gross margins in the low-70s, which is unusual for a hardware business and signals genuine pricing power rather than a cyclical spike. The bear case is not that the franchise is weak — it is that expectations are extreme, customer concentration is high, and two exogenous risks (China export policy, TSMC/CoWoS supply) sit largely outside management's control. The honest read is a strong franchise trading on a demanding forward bar.",
    keyMetrics: [
      { label: "Revenue (TTM)", value: "$128.4B", raw: 128400000000, delta: 1.14, trend: "up", commentary: "Driven by Data Center segment >85% of mix.", citationId: "c1" },
      { label: "Gross margin", value: "73.1%", raw: 0.731, delta: 0.041, trend: "up", commentary: "Low-70s margin on hardware implies durable pricing power.", citationId: "c1" },
      { label: "Data Center rev", value: "$110.6B", raw: 110600000000, delta: 1.42, trend: "up", commentary: "The entire thesis rides on this line item.", citationId: "c2" },
      { label: "Free cash flow", value: "$60.7B", raw: 60700000000, delta: 1.21, trend: "up", commentary: "FCF conversion funds R&D + buybacks without leverage.", citationId: "c1" },
      { label: "R&D intensity", value: "9.8% of rev", raw: 0.098, trend: "flat", commentary: "Re-investment sustains the annual cadence advantage.", citationId: "c2" },
      { label: "Net cash", value: "$26.0B", raw: 26000000000, trend: "up", commentary: "Balance sheet is a non-issue.", citationId: "c1" },
    ],
    risks: [
      { id: "r1", title: "China export-control exposure", detail: "The 10-K explicitly identifies U.S. government licensing requirements for advanced accelerators sold into China as a factor that has already reduced addressable demand and could tighten further. This is binary, policy-driven, and outside management control.", severity: "high", citationIds: ["c3"] },
      { id: "r2", title: "Supply concentration at TSMC / CoWoS", detail: "Advanced packaging and leading-edge wafer supply are concentrated with a small number of partners. The filing flags that capacity constraints can gate revenue even when demand exists. The self-critique promoted this from 'medium' after finding it under-weighted in the draft.", severity: "high", citationIds: ["c4"] },
      { id: "r3", title: "Customer concentration", detail: "A meaningful share of revenue flows through a handful of large cloud customers, several of which are simultaneously developing in-house silicon. Bargaining power could shift over a multi-year horizon.", severity: "medium", citationIds: ["c4"] },
      { id: "r4", title: "Expectations / valuation bar", detail: "The forward multiple embeds continued hyperscaler capex intensity. Any deceleration in AI infrastructure spend would compress both estimates and the multiple simultaneously — the classic double-hit.", severity: "medium", citationIds: ["c5"] },
    ],
    catalysts: [
      { id: "cat1", title: "Next-gen architecture ramp", detail: "The annual product cadence (new accelerator generation) historically resets ASPs higher and extends the performance lead. A clean ramp would validate the pricing-power thesis.", likelihood: "high", horizon: "next 2–3 quarters", citationIds: ["c2"] },
      { id: "cat2", title: "Networking + systems attach", detail: "Full-rack systems and networking increasingly sell alongside GPUs, raising revenue per deployment and deepening switching costs beyond raw silicon.", likelihood: "medium", horizon: "next 12 months", citationIds: ["c2"] },
      { id: "cat3", title: "Sovereign & enterprise demand broadening", detail: "News flow points to demand diversifying beyond the top hyperscalers toward sovereign and enterprise buildouts, which would soften the customer-concentration risk if it persists.", likelihood: "medium", horizon: "2026", citationIds: ["c5"] },
    ],
    citations: [
      { id: "c1", kind: "XBRL", title: "NVIDIA FY company facts (XBRL)", snippet: "Revenues 128,400; GrossProfit 93,860 → 73.1% gross margin; free cash flow 60,700.", url: "https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json", locator: "us-gaap:Revenues, GrossProfit", filedAt: "2026-02-26" },
      { id: "c2", kind: "10-K", title: "NVIDIA 10-K — Item 7 (MD&A)", snippet: "Data Center revenue growth was driven by demand for accelerated computing platforms; the company introduces new architectures on a roughly annual cadence.", url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001045810&type=10-K", locator: "Item 7, MD&A", filedAt: "2026-02-26" },
      { id: "c3", kind: "10-K", title: "NVIDIA 10-K — Item 1A (Risk Factors)", snippet: "U.S. government licensing requirements applicable to sales of certain products into China and other regions have adversely affected, and may further affect, our results.", locator: "Item 1A — Regulatory", filedAt: "2026-02-26" },
      { id: "c4", kind: "10-K", title: "NVIDIA 10-K — Item 1A (Supply & customers)", snippet: "We depend on a limited number of foundry and advanced-packaging partners; capacity constraints have limited and may limit our ability to meet demand. A limited number of customers account for a significant portion of revenue.", locator: "Item 1A — Supply / Concentration", filedAt: "2026-02-26" },
      { id: "c5", kind: "news", title: "Sell-side note: AI capex durability debate", snippet: "Analysts remain split on whether hyperscaler AI capex intensity is sustainable at current levels through the next cycle.", locator: "aggregated headlines, 14-day window", filedAt: "2026-07-11" },
    ],
    critique: {
      verdict: "revised",
      supportedClaims: 17,
      totalClaims: 18,
      unsupportedRemoved: [
        { claim: "NVIDIA's software moat makes its position 'unassailable' for the next decade.", reason: "Superlative not supported by any retrieved chunk; 'unassailable' is a forward-looking absolute the evidence can't back. Softened to 'durable but contested'." },
      ],
      contradictions: [
        { claim: "Draft implied customer concentration was a minor issue.", evidence: "Item 1A explicitly lists customer concentration and in-house-silicon development as a risk; draft under-weighted it.", citationId: "c4" },
      ],
      confidenceAdjustment: -8,
      notes: "One superlative removed. Supply-concentration risk promoted from medium→high and confidence cut 8 points (82→74) after the critic found the draft leaned on demand strength while under-pricing the two exogenous, management-uncontrollable risks. All remaining 17 claims trace to a citation.",
    },
    disclaimer: DISCLAIMER,
    toolCalls: toolCalls("NVDA"),
    cost: cost(),
    mode: "demo",
    publishedToTrackRecord: true,
  },

  DIS: {
    id: "memo_dis_2026q2",
    ticker: "DIS",
    company: "The Walt Disney Company",
    sector: "Media / Streaming",
    question: "How exposed is DIS to streaming competition?",
    asOf: "2026-07-15",
    stance: "mixed",
    confidenceScore: 58,
    confidenceRationale:
      "The evidence quality here is materially lower than for a hardware name: the streaming-profitability inflection depends on management execution (bundling, password-sharing, price increases) that filings describe qualitatively but don't quantify forward. Two credible readings coexist in the same 10-K. Confidence sits near the middle deliberately — the honest signal is genuine uncertainty, not hedging.",
    thesis:
      "Disney's streaming exposure is best understood as a transition, not a threat in the abstract. The linear-TV business is in structural decline while Direct-to-Consumer has only recently crossed into operating profitability — so the whole equity story hinges on whether DTC margin expansion can outrun linear erosion. The retrieved filing language supports both the bull framing (a rare profitable subscale streamer with pricing power and a bundle) and the bear framing (content spend, churn, and competition from deeper-pocketed platforms). The parks segment is the ballast that buys management time. This is a genuinely two-sided setup.",
    keyMetrics: [
      { label: "Total revenue (TTM)", value: "$92.1B", raw: 92100000000, delta: 0.036, trend: "up", commentary: "Low-single-digit growth; mix shift matters more than the top line.", citationId: "d1" },
      { label: "DTC operating income", value: "$1.35B", raw: 1350000000, delta: 2.9, trend: "up", commentary: "Recently turned profitable — the pivotal line.", citationId: "d2" },
      { label: "Linear networks op income", value: "$2.9B", raw: 2900000000, delta: -0.23, trend: "down", commentary: "Structural decline; the clock the DTC ramp races against.", citationId: "d2" },
      { label: "Parks & Experiences margin", value: "28.4%", raw: 0.284, trend: "flat", commentary: "The cash ballast funding the transition.", citationId: "d1" },
      { label: "Core streaming subs", value: "174M", raw: 174000000, delta: 0.06, trend: "up", commentary: "Growth slowing; ARPU + churn now matter more than net adds.", citationId: "d3" },
    ],
    risks: [
      { id: "r1", title: "Linear decline outpaces DTC ramp", detail: "The 10-K describes accelerating cord-cutting and affiliate/advertising pressure. If linear erodes faster than DTC scales, consolidated margins compress even as streaming 'wins'.", severity: "high", citationIds: ["d2", "d4"] },
      { id: "r2", title: "Competitive content spend", detail: "Item 1A flags intense competition for content and talent from well-capitalized streaming competitors, which can force elevated content spend to defend engagement.", severity: "high", citationIds: ["d4"] },
      { id: "r3", title: "Churn / price-increase sensitivity", detail: "Profitability improvements lean on price increases and paid-sharing. Both raise churn risk if the value perception slips versus competitors.", severity: "medium", citationIds: ["d4"] },
    ],
    catalysts: [
      { id: "cat1", title: "Bundle + paid-sharing monetization", detail: "MD&A points to bundling and account-sharing enforcement as levers still ramping — each incremental point of ARPU flows heavily to DTC margin.", likelihood: "medium", horizon: "next 2–4 quarters", citationIds: ["d2"] },
      { id: "cat2", title: "Parks cyclical strength", detail: "Parks demand provides cash-flow cover for the streaming transition and can surprise on international capacity additions.", likelihood: "medium", horizon: "2026", citationIds: ["d1"] },
      { id: "cat3", title: "Sports/streaming distribution shifts", detail: "News flow highlights evolving sports-rights and direct distribution strategy, a potential swing factor for engagement and ARPU.", likelihood: "low", horizon: "12–18 months", citationIds: ["d5"] },
    ],
    citations: [
      { id: "d1", kind: "XBRL", title: "Disney FY company facts (XBRL)", snippet: "Revenues 92,100; Parks segment operating margin ≈ 28.4%.", url: "https://data.sec.gov/api/xbrl/companyfacts/CIK0001744489.json", locator: "us-gaap:Revenues", filedAt: "2025-11-14" },
      { id: "d2", kind: "10-K", title: "Disney 10-K — Item 7 (Segment MD&A)", snippet: "Direct-to-Consumer results improved to operating income as subscription revenue growth and cost actions offset content amortization; Linear Networks results declined amid affiliate and advertising pressure.", locator: "Item 7 — Segment results", filedAt: "2025-11-14" },
      { id: "d3", kind: "10-K", title: "Disney 10-K — subscriber disclosures", snippet: "Core subscriber counts grew modestly; average monthly revenue per paid subscriber is emphasized as a key operating metric.", locator: "Item 7 — Key metrics", filedAt: "2025-11-14" },
      { id: "d4", kind: "10-K", title: "Disney 10-K — Item 1A (Risk Factors)", snippet: "We face intense competition for subscribers, content, and talent; consumer shift away from linear television adversely affects our traditional businesses; retaining subscribers depends on pricing and content investment.", locator: "Item 1A — Competition / Consumer shift", filedAt: "2025-11-14" },
      { id: "d5", kind: "news", title: "Recent headlines — sports rights & distribution", snippet: "Coverage centers on evolving direct-to-consumer sports strategy and its uncertain effect on engagement economics.", locator: "14-day window", filedAt: "2026-07-10" },
    ],
    critique: {
      verdict: "revised",
      supportedClaims: 14,
      totalClaims: 16,
      unsupportedRemoved: [
        { claim: "DTC will reach double-digit operating margins by next fiscal year.", reason: "Specific forward margin target appears nowhere in retrieved evidence — this was model speculation. Removed." },
        { claim: "Parks can indefinitely offset streaming losses.", reason: "'Indefinitely' is unsupported and contradicted by cyclicality language; softened to 'buys time'." },
      ],
      contradictions: [],
      confidenceAdjustment: -6,
      notes: "Two forward-looking claims removed for lack of citation support. Confidence cut 6 points (64→58) because the strongest bull point relied on a quantitative forward target the filings never state. The two-sided framing was retained because both readings are genuinely supported by Item 1A + Item 7.",
    },
    disclaimer: DISCLAIMER,
    toolCalls: toolCalls("DIS"),
    cost: cost({ tokensIn: 20110, tokensOut: 2980, costUsd: 0.0118, latencyMs: 6980 }),
    mode: "demo",
    publishedToTrackRecord: true,
  },

  TSLA: {
    id: "memo_tsla_2026q2",
    ticker: "TSLA",
    company: "Tesla, Inc.",
    sector: "Autos / Energy",
    question: "Research memo on TSLA — focus on margins.",
    asOf: "2026-07-14",
    stance: "cautious",
    confidenceScore: 46,
    confidenceRationale:
      "This is the lowest-confidence memo of the set, and that is the correct signal. The valuation-relevant question — whether Tesla is an auto company or an autonomy/energy platform — cannot be resolved from filings, which describe the automotive and energy segments concretely but treat FSD/robotaxi optionality only in forward-looking, unquantified terms. High dispersion in the evidence maps to a deliberately low score.",
    thesis:
      "Tesla's margin story has two layers that the filings let you separate cleanly. The automotive layer is a maturing, increasingly competitive business where price actions have compressed gross margin toward the mid-teens — visible and quantifiable. The optionality layer (energy storage scaling well, plus autonomy/services) is where the equity's valuation actually lives, and the filings describe it only qualitatively. A margin-focused read has to hold these apart: the measurable core is decelerating, while the part that would justify the multiple is precisely the part the evidence can't yet confirm. Hence a cautious, low-confidence stance rather than a directional call.",
    keyMetrics: [
      { label: "Automotive gross margin (ex-credits)", value: "~16.2%", raw: 0.162, delta: -0.038, trend: "down", commentary: "Price cuts to defend volume compressed the core margin.", citationId: "t1" },
      { label: "Energy gen & storage rev", value: "$28.6B", raw: 28600000000, delta: 0.54, trend: "up", commentary: "Fastest-growing, increasingly profitable segment.", citationId: "t2" },
      { label: "Total revenue (TTM)", value: "$101.3B", raw: 101300000000, delta: 0.09, trend: "up", commentary: "Growth now led by energy, not autos.", citationId: "t1" },
      { label: "Free cash flow", value: "$4.4B", raw: 4400000000, delta: -0.12, trend: "down", commentary: "Positive but pressured by capex + price actions.", citationId: "t1" },
      { label: "Operating margin", value: "8.9%", raw: 0.089, delta: -0.026, trend: "down", commentary: "Down from prior peak; mix and pricing dependent.", citationId: "t2" },
    ],
    risks: [
      { id: "r1", title: "Automotive margin compression", detail: "MD&A ties gross-margin declines to pricing actions taken to sustain volume amid rising EV competition — a dynamic that can persist as long as demand elasticity is being tested.", severity: "high", citationIds: ["t2"] },
      { id: "r2", title: "Autonomy timeline is unquantified", detail: "The valuation leans on FSD/robotaxi outcomes that Item 1A treats as forward-looking and uncertain, with explicit regulatory and technological caveats. The critic flagged any margin thesis that implicitly credits this.", severity: "high", citationIds: ["t3"] },
      { id: "r3", title: "Demand elasticity & competition", detail: "Item 1A cites intensifying global EV competition and macro sensitivity of demand, which constrains pricing power.", severity: "medium", citationIds: ["t3"] },
    ],
    catalysts: [
      { id: "cat1", title: "Energy storage margin scaling", detail: "The energy segment's growth and improving profitability could re-mix consolidated margins upward independent of auto pricing.", likelihood: "medium", horizon: "2026", citationIds: ["t2"] },
      { id: "cat2", title: "Cost-per-vehicle reduction", detail: "MD&A references ongoing manufacturing-cost reductions; sustained progress could stabilize automotive margins.", likelihood: "medium", horizon: "next 2–3 quarters", citationIds: ["t2"] },
      { id: "cat3", title: "Autonomy/service optionality", detail: "Any concrete, disclosed monetization of autonomy would be a step-change — but the filing gives no quantitative basis to size it, so it stays low-likelihood in this memo.", likelihood: "low", horizon: "unclear", citationIds: ["t3"] },
    ],
    citations: [
      { id: "t1", kind: "XBRL", title: "Tesla FY company facts (XBRL)", snippet: "Revenues 101,300; automotive gross margin ex-credits in the mid-teens; free cash flow 4,400.", url: "https://data.sec.gov/api/xbrl/companyfacts/CIK0001318605.json", locator: "us-gaap:Revenues, GrossProfit", filedAt: "2026-01-29" },
      { id: "t2", kind: "10-K", title: "Tesla 10-K — Item 7 (MD&A)", snippet: "Automotive gross margin decreased primarily due to pricing actions; energy generation and storage revenue and profitability increased; manufacturing cost reductions continued.", locator: "Item 7 — MD&A", filedAt: "2026-01-29" },
      { id: "t3", kind: "10-K", title: "Tesla 10-K — Item 1A (Risk Factors)", snippet: "Our future growth depends on market acceptance and on autonomous-driving technologies subject to significant regulatory and technological uncertainty; we face intense and increasing competition.", locator: "Item 1A — Competition / Autonomy", filedAt: "2026-01-29" },
    ],
    critique: {
      verdict: "flagged",
      supportedClaims: 12,
      totalClaims: 15,
      unsupportedRemoved: [
        { claim: "Robotaxi economics will lift blended margins within two years.", reason: "No filing evidence quantifies robotaxi economics or timeline; pure speculation. Removed and re-flagged as a risk instead." },
        { claim: "Energy will surpass automotive in gross profit next year.", reason: "Forward crossover not stated in any retrieved chunk. Removed." },
      ],
      contradictions: [
        { claim: "An earlier draft sentence implied stable automotive margins.", evidence: "MD&A explicitly attributes gross-margin declines to pricing actions — directly contradicts 'stable'.", citationId: "t2" },
      ],
      confidenceAdjustment: -11,
      notes: "The most heavily revised memo. Two speculative claims removed, one internal contradiction fixed, confidence cut 11 points (57→46). Verdict 'flagged' because the equity's valuation driver (autonomy) is exactly the claim the evidence cannot support — the memo surfaces that gap rather than papering over it.",
    },
    disclaimer: DISCLAIMER,
    toolCalls: toolCalls("TSLA"),
    cost: cost({ tokensIn: 22540, tokensOut: 3340, costUsd: 0.0133, latencyMs: 7810 }),
    mode: "demo",
    publishedToTrackRecord: true,
  },
};

export const MEMO_LIST = Object.values(MEMOS);

export function getMemo(idOrTicker: string): Memo | undefined {
  const key = idOrTicker.toUpperCase();
  if (MEMOS[key]) return MEMOS[key];
  return MEMO_LIST.find((m) => m.id === idOrTicker);
}
