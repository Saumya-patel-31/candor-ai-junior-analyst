import { config, UNIVERSE } from "@/lib/config";

/**
 * SEC EDGAR + XBRL.
 *
 * ACCURACY NOTE — the hard part of XBRL is PERIODS, not fetching. A naive
 * "latest value per concept" is dangerously wrong:
 *   • `Revenues` for NVDA resolves to a single 90-day quarter ($81.6B), which
 *     reads as annual revenue but is ~2.6x off the real FY figure ($215.9B).
 *   • Deprecated concepts keep returning years-stale values (a FY2022 number
 *     presented next to FY2026 ones).
 *   • A margin computed from two different periods is meaningless.
 *
 * So every fact here is period-classified, explicitly labelled, staleness-
 * filtered, and ratios are only derived from facts sharing the same period.
 *
 * SEC fair-access policy requires a descriptive User-Agent with contact info
 * and caps traffic (~10 req/s). No auth token — the data is public.
 */

const SEC_HEADERS = () => ({
  "User-Agent": config.sec.userAgent,
  Accept: "application/json",
});

let lastCall = 0;
async function throttle() {
  const minGap = 1000 / config.sec.maxRps;
  const wait = Math.max(0, lastCall + minGap - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

export function cikFor(ticker: string): string | null {
  return UNIVERSE[ticker.toUpperCase()]?.cik ?? null;
}

/* ─────────────────────────────────────────────────────────────────────────
   Raw XBRL shapes
   ───────────────────────────────────────────────────────────────────────── */
interface RawPoint {
  val: number;
  start?: string;
  end: string;
  form: string;
  fy?: number;
  fp?: string;
  frame?: string;
}
type Gaap = Record<string, { label?: string; units?: Record<string, RawPoint[]> }>;

export type PeriodType = "ttm" | "annual" | "quarter" | "ytd" | "instant";

export interface FinancialFact {
  key: string;
  label: string;
  value: number;
  /** Human-readable period, always shown to the model: "FY2026", "TTM ending 2026-04-26". */
  period: string;
  periodType: PeriodType;
  end: string;
  form: string;
  /** Year-over-year change as a decimal (0.12 = +12%), when a comparable prior period exists. */
  yoy?: number;
}

const DAY = 86_400_000;
const days = (p: RawPoint) => (p.start ? Math.round((+new Date(p.end) - +new Date(p.start)) / DAY) : 0);
const isAnnual = (p: RawPoint) => days(p) >= 340 && days(p) <= 380;
const isQuarter = (p: RawPoint) => days(p) >= 80 && days(p) <= 100;
const isInstant = (p: RawPoint) => !p.start;
const byEndDesc = (a: RawPoint, b: RawPoint) => (a.end < b.end ? 1 : -1);

/** Drop anything older than this — prevents deprecated concepts leaking stale values. */
const MAX_AGE_DAYS = 800;
const fresh = (p: RawPoint) => +new Date(p.end) > Date.now() - MAX_AGE_DAYS * DAY;

/** Prefer originally-reported 10-K/10-Q points. */
const filed = (p: RawPoint) => p.form === "10-K" || p.form === "10-Q";

/** Dedupe identical (end,val) restatements, keeping the first seen. */
function dedupe(points: RawPoint[]): RawPoint[] {
  const seen = new Set<string>();
  return points.filter((p) => {
    const k = `${p.start ?? ""}|${p.end}|${p.val}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Resolve a concept to its usable points.
 *
 * Preference order matters, but FRESHNESS beats preference: companies migrate
 * between tags, so a preferred concept can be years stale while a fallback is
 * current (NVDA still has RevenueFromContractWithCustomer... but only through
 * FY2022, while `Revenues` is current — picking the former silently drops
 * revenue from the memo entirely).
 */
function pointsFor(gaap: Gaap, concepts: string[]): RawPoint[] {
  const candidates = concepts
    .map((c) => dedupe((gaap[c]?.units?.USD ?? []).filter(filed)).sort(byEndDesc))
    .filter((pts) => pts.length > 0);
  if (!candidates.length) return [];
  // First preferred concept that still reports recent data…
  const current = candidates.find((pts) => fresh(pts[0]));
  if (current) return current;
  // …otherwise the least-stale one, so the caller can decide to drop it.
  return candidates.sort((a, b) => (a[0].end < b[0].end ? 1 : -1))[0];
}

const fyLabel = (p: RawPoint) => (p.fy ? `FY${p.fy}` : `FY ending ${p.end}`);
const qLabel = (p: RawPoint) => `${p.fp ?? "Q"} ${p.fy ? `FY${p.fy}` : ""}`.trim();

/**
 * Trailing-twelve-months for a flow metric.
 * TTM = last full fiscal year + current year-to-date − prior-year same year-to-date.
 * Falls back to the latest annual figure when no newer interim data exists.
 */
function computeTtm(points: RawPoint[]): { value: number; end: string; derived: boolean } | null {
  const annuals = points.filter(isAnnual);
  if (!annuals.length) return null;
  const fy = annuals[0];

  // Interim cumulative periods that END AFTER the last fiscal year close.
  const interims = points.filter((p) => p.start && !isAnnual(p) && p.end > fy.end).sort(byEndDesc);
  const ytd = interims[0];
  if (!ytd || !ytd.start) return { value: fy.val, end: fy.end, derived: false };

  const ytdDays = days(ytd);
  // Prior-year comparable: same length, ending ~365 days earlier.
  const target = +new Date(ytd.end) - 365 * DAY;
  const prior = points
    .filter((p) => p.start && Math.abs(days(p) - ytdDays) <= 12)
    .map((p) => ({ p, gap: Math.abs(+new Date(p.end) - target) }))
    .filter((x) => x.gap <= 30 * DAY)
    .sort((a, b) => a.gap - b.gap)[0]?.p;

  if (!prior) return { value: fy.val, end: fy.end, derived: false };
  return { value: fy.val + ytd.val - prior.val, end: ytd.end, derived: true };
}

/** YoY for an annual figure: latest FY vs the prior FY. */
function annualYoy(points: RawPoint[]): number | undefined {
  const annuals = points.filter(isAnnual);
  if (annuals.length < 2) return undefined;
  const [cur, prev] = annuals;
  if (!prev.val) return undefined;
  return cur.val / prev.val - 1;
}

/** Flow metric (income statement): report TTM when derivable, else latest FY. */
function flowFact(key: string, label: string, points: RawPoint[]): FinancialFact | null {
  if (!points.length) return null;
  const ttm = computeTtm(points);
  if (ttm) {
    const src = points.filter(isAnnual)[0];
    if (!fresh(src)) return null;
    return {
      key,
      label: ttm.derived ? `${label} (TTM)` : label,
      value: ttm.value,
      period: ttm.derived ? `TTM ending ${ttm.end}` : fyLabel(src),
      periodType: ttm.derived ? "ttm" : "annual",
      end: ttm.end,
      form: src.form,
      yoy: annualYoy(points),
    };
  }
  // No annual data — fall back to the latest quarter, clearly labelled as such.
  const q = points.filter(isQuarter).filter(fresh)[0];
  if (!q) return null;
  return { key, label: `${label} (quarter)`, value: q.val, period: qLabel(q), periodType: "quarter", end: q.end, form: q.form };
}

/** Stock metric (balance sheet): latest point-in-time value. */
function instantFact(key: string, label: string, points: RawPoint[]): FinancialFact | null {
  const p = points.filter(isInstant).filter(fresh)[0];
  if (!p) return null;
  return { key, label, value: p.val, period: `as of ${p.end}`, periodType: "instant", end: p.end, form: p.form };
}

/* Concept fallbacks, most-preferred first. Companies tag revenue differently. */
const CONCEPTS = {
  revenue: [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "SalesRevenueNet",
  ],
  grossProfit: ["GrossProfit"],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  rnd: ["ResearchAndDevelopmentExpense"],
  opCashFlow: ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment"],
  cash: ["CashAndCashEquivalentsAtCarryingValue"],
  totalDebt: ["LongTermDebtNoncurrent", "LongTermDebt"],
  equity: ["StockholdersEquity"],
} as const;

export interface Financials {
  ticker: string;
  facts: FinancialFact[];
  /** Ratios derived ONLY from same-period facts. */
  ratios: { label: string; value: number; period: string; basis: string }[];
  asOf: string;
}

/** Period-aware financial snapshot from XBRL company facts. */
export async function getFinancials(ticker: string): Promise<Financials> {
  const cik = cikFor(ticker);
  if (!cik) throw new Error(`No CIK on file for ${ticker} (extend UNIVERSE in lib/config.ts)`);
  await throttle();

  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  const res = await fetch(url, { headers: SEC_HEADERS(), next: { revalidate: 60 * 60 * 24 } });
  if (!res.ok) throw new Error(`EDGAR companyfacts ${res.status} for ${ticker}`);
  const json = (await res.json()) as { facts?: { "us-gaap"?: Gaap } };
  const gaap = json.facts?.["us-gaap"] ?? {};

  const P = (k: keyof typeof CONCEPTS) => pointsFor(gaap, [...CONCEPTS[k]]);
  const pts = {
    revenue: P("revenue"),
    grossProfit: P("grossProfit"),
    operatingIncome: P("operatingIncome"),
    netIncome: P("netIncome"),
    rnd: P("rnd"),
    opCashFlow: P("opCashFlow"),
    capex: P("capex"),
    cash: P("cash"),
    totalDebt: P("totalDebt"),
    equity: P("equity"),
  };

  const facts = [
    flowFact("revenue", "Revenue", pts.revenue),
    flowFact("grossProfit", "Gross profit", pts.grossProfit),
    flowFact("operatingIncome", "Operating income", pts.operatingIncome),
    flowFact("netIncome", "Net income", pts.netIncome),
    flowFact("rnd", "R&D expense", pts.rnd),
    flowFact("opCashFlow", "Operating cash flow", pts.opCashFlow),
    flowFact("capex", "Capital expenditures", pts.capex),
    instantFact("cash", "Cash & equivalents", pts.cash),
    instantFact("totalDebt", "Long-term debt", pts.totalDebt),
    instantFact("equity", "Shareholders' equity", pts.equity),
  ].filter((f): f is FinancialFact => f !== null);

  // Ratios: ONLY from facts covering the same period — otherwise skip.
  const byKey = new Map(facts.map((f) => [f.key, f]));
  const ratios: Financials["ratios"] = [];
  const samePeriod = (a?: FinancialFact, b?: FinancialFact) =>
    !!a && !!b && a.period === b.period && b.value !== 0;

  const rev = byKey.get("revenue");
  if (samePeriod(byKey.get("grossProfit"), rev)) {
    ratios.push({ label: "Gross margin", value: byKey.get("grossProfit")!.value / rev!.value, period: rev!.period, basis: "grossProfit / revenue" });
  }
  if (samePeriod(byKey.get("operatingIncome"), rev)) {
    ratios.push({ label: "Operating margin", value: byKey.get("operatingIncome")!.value / rev!.value, period: rev!.period, basis: "operatingIncome / revenue" });
  }
  if (samePeriod(byKey.get("netIncome"), rev)) {
    ratios.push({ label: "Net margin", value: byKey.get("netIncome")!.value / rev!.value, period: rev!.period, basis: "netIncome / revenue" });
  }
  if (samePeriod(byKey.get("rnd"), rev)) {
    ratios.push({ label: "R&D intensity", value: byKey.get("rnd")!.value / rev!.value, period: rev!.period, basis: "R&D / revenue" });
  }
  const ocf = byKey.get("opCashFlow");
  const capex = byKey.get("capex");
  if (samePeriod(ocf, capex) && rev) {
    const fcf = ocf!.value - Math.abs(capex!.value);
    facts.push({ key: "fcf", label: "Free cash flow (derived)", value: fcf, period: ocf!.period, periodType: ocf!.periodType, end: ocf!.end, form: ocf!.form });
    if (rev.period === ocf!.period && rev.value) {
      ratios.push({ label: "FCF margin", value: fcf / rev.value, period: rev.period, basis: "(opCashFlow − capex) / revenue" });
    }
  }

  return { ticker: ticker.toUpperCase(), facts, ratios, asOf: new Date().toISOString().slice(0, 10) };
}

export interface FilingSection {
  form: string;
  item: string;
  text: string;
  filedAt: string;
  accession: string;
}

/**
 * Full-text search over EDGAR. Section extraction into RAG rows is done by the
 * Python ingestion pipeline (/ingestion/ingest.py); this is only a cold-path stub.
 */
export async function searchEdgarFullText(ticker: string, query: string): Promise<FilingSection[]> {
  await throttle();
  const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${ticker}" ${query}`)}&forms=10-K`;
  try {
    const res = await fetch(url, { headers: SEC_HEADERS() });
    if (!res.ok) return [];
    return [];
  } catch {
    return [];
  }
}
