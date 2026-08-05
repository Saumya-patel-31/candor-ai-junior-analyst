import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compact large numbers: 1_240_000_000 → "1.24B". */
export function compact(n: number, digits = 2): string {
  if (n === 0) return "0";
  const abs = Math.abs(n);
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${(n / size).toFixed(digits)}${suffix}`;
  }
  return n.toFixed(digits);
}

export function usd(n: number, opts: { compact?: boolean; digits?: number } = {}): string {
  if (opts.compact) return `$${compact(n, opts.digits ?? 2)}`;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts.digits ?? 2,
  });
}

/** 0.1234 → "+12.34%". Pass alreadyPercent when the input is 12.34 not 0.1234. */
export function pct(n: number, { sign = true, alreadyPercent = false, digits = 2 } = {}): string {
  const v = alreadyPercent ? n : n * 100;
  const s = sign && v > 0 ? "+" : "";
  return `${s}${v.toFixed(digits)}%`;
}

export function money(n: number): string {
  return `$${compact(n)}`;
}

/** Micro-cents pricing for token cost display: 0.0021 → "$0.0021". */
export function cost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

export function ms(n: number): string {
  if (n < 1000) return `${Math.round(n)}ms`;
  return `${(n / 1000).toFixed(2)}s`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const sleep = (n: number) => new Promise((r) => setTimeout(r, n));

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Deterministic id for demo entities. */
export function slugId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Map 0–100 confidence to a semantic label. */
export function confidenceLabel(score: number): string {
  if (score >= 80) return "High conviction";
  if (score >= 65) return "Constructive";
  if (score >= 50) return "Balanced";
  if (score >= 35) return "Tentative";
  return "Low confidence";
}
