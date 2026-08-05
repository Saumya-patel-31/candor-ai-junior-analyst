import { config } from "@/lib/config";

/**
 * Abuse / cost protection for the public agent endpoint.
 *
 * Two layers:
 *   1. per-IP daily cap  (CANDOR_DAILY_QUERY_CAP) — stops one visitor burning the quota
 *   2. global daily cap                            — stops the whole app burning it
 * Plus a short per-IP cooldown so a single client can't fire concurrent runs.
 *
 * NOTE: this is in-process. On a single instance (or a warm serverless function)
 * it holds; across many cold instances it is a best-effort first line of defence.
 * The hard backstops are the provider's own rate limits, CANDOR_KILL_SWITCH, and
 * the fact that every provider here is a free tier that simply 429s.
 */

interface Bucket {
  day: string;
  count: number;
  lastAt: number;
}

const buckets = new Map<string, Bucket>();
let globalBucket: Bucket = { day: "", count: 0, lastAt: 0 };

const COOLDOWN_MS = 3_000;
const GLOBAL_MULTIPLIER = 20;
const MAX_TRACKED_IPS = 5_000;

const today = () => new Date().toISOString().slice(0, 10);

export interface RateVerdict {
  allowed: boolean;
  reason?: string;
  retryAfterSec?: number;
  remaining: number;
}

/** Best-effort client identity from proxy headers (Vercel sets x-forwarded-for). */
export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "local";
}

export function checkRateLimit(key: string): RateVerdict {
  const day = today();
  const now = Date.now();
  const perIpCap = Math.max(1, config.dailyQueryCap);
  const globalCap = perIpCap * GLOBAL_MULTIPLIER;

  // Reset global window on a new day.
  if (globalBucket.day !== day) globalBucket = { day, count: 0, lastAt: 0 };
  if (globalBucket.count >= globalCap) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: 3600,
      reason: "Candor has hit its global daily analysis budget. This is a free-tier research demo — try again tomorrow, or run it locally with your own key.",
    };
  }

  // Evict oldest entries if the map grows unbounded.
  if (buckets.size > MAX_TRACKED_IPS) {
    const oldest = [...buckets.entries()].sort((a, b) => a[1].lastAt - b[1].lastAt).slice(0, 1000);
    for (const [k] of oldest) buckets.delete(k);
  }

  let b = buckets.get(key);
  if (!b || b.day !== day) {
    b = { day, count: 0, lastAt: 0 };
    buckets.set(key, b);
  }

  if (now - b.lastAt < COOLDOWN_MS) {
    return {
      allowed: false,
      remaining: Math.max(0, perIpCap - b.count),
      retryAfterSec: Math.ceil((COOLDOWN_MS - (now - b.lastAt)) / 1000),
      reason: "One analysis at a time — give the current run a moment to finish.",
    };
  }

  if (b.count >= perIpCap) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: 3600,
      reason: `Daily limit reached (${perIpCap} analyses). This is a free-tier research demo — the cap keeps it running for everyone. Resets at midnight UTC.`,
    };
  }

  b.count += 1;
  b.lastAt = now;
  globalBucket.count += 1;
  globalBucket.lastAt = now;
  return { allowed: true, remaining: Math.max(0, perIpCap - b.count) };
}
