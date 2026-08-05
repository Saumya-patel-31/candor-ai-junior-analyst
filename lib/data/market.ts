/**
 * Market data — daily closes for outcome resolution. Provider-abstracted:
 * Alpha Vantage (historical daily) preferred, Finnhub candles as fallback.
 * Everything degrades gracefully: no key → marketConfigured() is false and the
 * resolver skips (rather than throwing).
 */

const BENCHMARK = (process.env.CANDOR_BENCHMARK || "SPY").toUpperCase();
const closesCache = new Map<string, Record<string, number>>();

export function marketConfigured(): boolean {
  return Boolean(process.env.ALPHAVANTAGE_API_KEY || process.env.FINNHUB_API_KEY);
}

async function closesAlphaVantage(ticker: string): Promise<Record<string, number>> {
  const key = process.env.ALPHAVANTAGE_API_KEY!;
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&outputsize=full&apikey=${key}`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 6 } });
  if (!res.ok) throw new Error(`AlphaVantage ${res.status}`);
  const json = (await res.json()) as { "Time Series (Daily)"?: Record<string, { "4. close": string }> };
  const series = json["Time Series (Daily)"];
  if (!series) throw new Error("AlphaVantage: no series (rate-limited?)");
  const out: Record<string, number> = {};
  for (const [date, row] of Object.entries(series)) out[date] = Number(row["4. close"]);
  return out;
}

async function closesFinnhub(ticker: string, from: string, to: string): Promise<Record<string, number>> {
  const key = process.env.FINNHUB_API_KEY!;
  const f = Math.floor(new Date(from).getTime() / 1000) - 5 * 86400;
  const t = Math.floor(new Date(to).getTime() / 1000) + 5 * 86400;
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${f}&to=${t}&token=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub ${res.status}`);
  const json = (await res.json()) as { s: string; c?: number[]; t?: number[] };
  if (json.s !== "ok" || !json.c || !json.t) throw new Error("Finnhub: no candles");
  const out: Record<string, number> = {};
  json.t.forEach((ts, i) => {
    out[new Date(ts * 1000).toISOString().slice(0, 10)] = json.c![i];
  });
  return out;
}

async function getCloses(ticker: string, from: string, to: string): Promise<Record<string, number>> {
  const cached = closesCache.get(ticker);
  if (cached) return cached;
  const closes = process.env.ALPHAVANTAGE_API_KEY
    ? await closesAlphaVantage(ticker)
    : await closesFinnhub(ticker, from, to);
  closesCache.set(ticker, closes);
  return closes;
}

/** Nearest available close on or before a target date. */
function closeOnOrBefore(closes: Record<string, number>, date: string): number | null {
  const dates = Object.keys(closes).sort();
  let pick: string | null = null;
  for (const d of dates) {
    if (d <= date) pick = d;
    else break;
  }
  return pick ? closes[pick] : null;
}

/** Total return (decimal) for a ticker between two dates. */
export async function getReturn(ticker: string, from: string, to: string): Promise<number | null> {
  const closes = await getCloses(ticker, from, to);
  const a = closeOnOrBefore(closes, from);
  const b = closeOnOrBefore(closes, to);
  if (a == null || b == null || a === 0) return null;
  return b / a - 1;
}

export async function getBenchmarkReturn(from: string, to: string): Promise<number> {
  try {
    const r = await getReturn(BENCHMARK, from, to);
    return r ?? 0;
  } catch {
    return 0;
  }
}
