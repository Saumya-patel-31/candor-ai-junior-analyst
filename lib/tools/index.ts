import { compact } from "@/lib/utils";
import type { Citation, ToolName } from "@/lib/types";
import { getFinancials, cikFor } from "@/lib/data/sec";

/**
 * Tool layer. Each tool returns a normalized evidence bundle: a human summary
 * (fed to the synthesizer), the citations it produced, and raw data. Every tool
 * degrades gracefully — a missing API key yields an empty, noted result rather
 * than throwing, so the agent can still reason over whatever it does have.
 */
export interface ToolResult {
  tool: ToolName;
  summary: string;
  citations: Citation[];
  latencyMs: number;
  ok: boolean;
}

/** JSON-schema tool definitions — provider-agnostic (OpenAI-style function/tool calling). */
export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}
export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "get_fundamentals",
    description: "Structured XBRL financials for a ticker (revenue, margins, FCF, R&D, cash). Highest-trust source.",
    input_schema: { type: "object", properties: { ticker: { type: "string" } }, required: ["ticker"] },
  },
  {
    name: "search_filings",
    description: "Hybrid RAG over 10-K/10-Q risk factors and MD&A. Returns citable filing chunks.",
    input_schema: {
      type: "object",
      properties: { ticker: { type: "string" }, query: { type: "string" } },
      required: ["ticker", "query"],
    },
  },
  {
    name: "get_recent_news",
    description: "Recent headlines for a ticker over a lookback window. Medium trust.",
    input_schema: {
      type: "object",
      properties: { ticker: { type: "string" }, lookbackDays: { type: "number" } },
      required: ["ticker"],
    },
  },
];

// ── get_fundamentals ────────────────────────────────────────────────────────
async function getFundamentals(ticker: string): Promise<ToolResult> {
  const t0 = Date.now();
  try {
    const fin = await getFinancials(ticker);
    if (!fin.facts.length) {
      return { tool: "get_fundamentals", ok: false, summary: `No usable XBRL facts resolved for ${ticker}.`, citations: [], latencyMs: Date.now() - t0 };
    }

    // Every line carries its period — the model must never present a quarter as a year.
    const factLines = fin.facts.map(
      (f) => `${f.label}: $${compact(f.value)} [${f.period}]${f.yoy !== undefined ? ` (YoY ${(f.yoy * 100).toFixed(1)}%)` : ""}`,
    );
    const ratioLines = fin.ratios.map((r) => `${r.label}: ${(r.value * 100).toFixed(1)}% [${r.period}]`);

    const summary = [
      `Period-normalized XBRL for ${ticker} (each figure is labelled with its exact period —`,
      `report the period alongside any number; never present a quarter as an annual figure):`,
      "",
      ...factLines,
      ratioLines.length ? "\nDerived ratios (same-period only):" : "",
      ...ratioLines,
    ]
      .filter(Boolean)
      .join("\n");

    const headline = [...factLines.slice(0, 4), ...ratioLines.slice(0, 2)].join("; ");
    const citations: Citation[] = [
      {
        id: "c_xbrl",
        kind: "XBRL",
        title: `${ticker} company facts (XBRL, period-normalized)`,
        snippet: headline,
        url: `https://data.sec.gov/api/xbrl/companyfacts/CIK${cikFor(ticker) ?? ""}.json`,
        locator: "us-gaap concepts · TTM/FY normalized",
        filedAt: fin.facts[0]?.end,
      },
    ];

    return { tool: "get_fundamentals", ok: true, summary, citations, latencyMs: Date.now() - t0 };
  } catch (e) {
    return {
      tool: "get_fundamentals",
      ok: false,
      summary: `get_fundamentals failed: ${(e as Error).message}`,
      citations: [],
      latencyMs: Date.now() - t0,
    };
  }
}

// ── search_filings (RAG) ─────────────────────────────────────────────────────
async function searchFilings(ticker: string, query: string): Promise<ToolResult> {
  const t0 = Date.now();
  // Live RAG runs against Supabase/pgvector (populated by /ingestion/ingest.py).
  // Wired in lib/data/embeddings.ts + a match_filing_chunks RPC. When the ticker
  // hasn't been ingested we return a graceful, honest empty result.
  const { retrieveFilingChunks } = await import("@/lib/data/embeddings");
  try {
    const chunks = await retrieveFilingChunks(ticker, query, 6);
    const citations: Citation[] = chunks.map((c, i) => ({
      id: `c_fil_${i}`,
      kind: c.form === "10-Q" ? "10-Q" : "10-K",
      title: `${ticker} ${c.form} — ${c.item}`,
      snippet: c.text.slice(0, 260),
      locator: c.item,
      filedAt: c.filedAt,
    }));
    return {
      tool: "search_filings",
      ok: chunks.length > 0,
      summary: chunks.length
        ? `Retrieved ${chunks.length} filing chunks for "${query}":\n` + chunks.map((c) => `• [${c.item}] ${c.text.slice(0, 180)}…`).join("\n")
        : `No ingested filing chunks for ${ticker}. Run: python ingestion/ingest.py ${ticker}`,
      citations,
      latencyMs: Date.now() - t0,
    };
  } catch (e) {
    return {
      tool: "search_filings",
      ok: false,
      summary: `search_filings unavailable (${(e as Error).message}). RAG requires Supabase/pgvector + ingestion.`,
      citations: [],
      latencyMs: Date.now() - t0,
    };
  }
}

// ── get_recent_news ─────────────────────────────────────────────────────────
async function getRecentNews(ticker: string, lookbackDays = 14): Promise<ToolResult> {
  const t0 = Date.now();
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    return { tool: "get_recent_news", ok: false, summary: "News tool not configured (set FINNHUB_API_KEY).", citations: [], latencyMs: Date.now() - t0 };
  }
  try {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - lookbackDays * 86400000).toISOString().slice(0, 10);
    const res = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${key}`);
    const items = (await res.json()) as { headline: string; summary: string; url: string; datetime: number }[];
    const top = items.slice(0, 8);
    const citations: Citation[] = top.slice(0, 2).map((n, i) => ({
      id: `c_news_${i}`,
      kind: "news",
      title: n.headline,
      snippet: n.summary?.slice(0, 220) ?? n.headline,
      url: n.url,
      filedAt: new Date(n.datetime * 1000).toISOString().slice(0, 10),
    }));
    return {
      tool: "get_recent_news",
      ok: top.length > 0,
      summary: `${items.length} headlines (${from}→${to}). Top:\n` + top.map((n) => `• ${n.headline}`).join("\n"),
      citations,
      latencyMs: Date.now() - t0,
    };
  } catch (e) {
    return { tool: "get_recent_news", ok: false, summary: `news failed: ${(e as Error).message}`, citations: [], latencyMs: Date.now() - t0 };
  }
}

export function executeTool(tool: ToolName, args: Record<string, unknown>): Promise<ToolResult> {
  const ticker = String(args.ticker ?? "").toUpperCase();
  switch (tool) {
    case "get_fundamentals":
      return getFundamentals(ticker);
    case "search_filings":
      return searchFilings(ticker, String(args.query ?? ""));
    case "get_recent_news":
      return getRecentNews(ticker, Number(args.lookbackDays ?? 14));
    default:
      return Promise.resolve({ tool, ok: false, summary: "Unknown tool", citations: [], latencyMs: 0 });
  }
}
