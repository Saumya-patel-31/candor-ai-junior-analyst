import { config } from "@/lib/config";
import { MemoDraftSchema, type MemoDraft } from "@/lib/types";
import type { ToolResult } from "@/lib/tools";
import { callJSON, type CallUsage } from "./llm";
import { SYNTH_SYSTEM } from "./prompts";

/* Token budget. Free tiers are tokens-per-minute capped (Groq: 12k TPM), and
   filing chunks are long, so the bundle is trimmed to a predictable size rather
   than blowing the limit and getting throttled mid-memo. ~4 chars ≈ 1 token. */
const MAX_SUMMARY_CHARS = 2600; // per tool
const MAX_SNIPPET_CHARS = 320; // per citation

const trim = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max).trimEnd()}…`);

/** Assemble the retrieved evidence into a single grounded prompt bundle. */
function buildEvidenceBundle(results: ToolResult[]): string {
  const blocks: string[] = [];
  const allCitations = results.flatMap((r) => r.citations);
  for (const r of results) {
    blocks.push(`### ${r.tool}${r.ok ? "" : " (no data)"}\n${trim(r.summary, MAX_SUMMARY_CHARS)}`);
  }
  const citationIndex = allCitations
    .map(
      (c) =>
        `- [${c.id}] (${c.kind}) ${c.title} — "${trim(c.snippet, MAX_SNIPPET_CHARS)}"${c.locator ? ` (${c.locator})` : ""}`,
    )
    .join("\n");
  return `EVIDENCE BUNDLE\n\n${blocks.join("\n\n")}\n\nAVAILABLE CITATION IDS (reuse these exact ids):\n${citationIndex || "- (none retrieved)"}`;
}

export async function synthesize(
  ticker: string,
  question: string,
  results: ToolResult[],
): Promise<{ draft: MemoDraft; usage: CallUsage }> {
  const bundle = buildEvidenceBundle(results);
  const { data, usage } = await callJSON({
    model: config.modelOverrides.synth,
    tier: "synth",
    system: SYNTH_SYSTEM,
    user: `Ticker: ${ticker}\nQuestion: ${question}\n\n${bundle}\n\nWrite the memo as JSON. Every claim must cite an available citation id.`,
    schema: MemoDraftSchema,
    // A full memo (6 metrics + 5 risks + 4 catalysts) overruns 4k on verbose
    // models, truncating the JSON mid-array.
    maxTokens: 8192,
    temperature: 0.5,
  });

  // The retrieved citations are authoritative — we already have their exact ids,
  // titles and snippets from the tools. Asking the model to echo that metadata back
  // is a needless failure mode (some models return an empty `citations` array, which
  // then strips every claim as "uncited"). The model's only job is to reference ids;
  // provenance is filled in server-side from the real evidence.
  const retrieved = results.flatMap((r) => r.citations);
  const seen = new Set(retrieved.map((c) => c.id));
  const citations = [...retrieved, ...data.citations.filter((c) => !seen.has(c.id))];

  return { draft: { ...data, citations }, usage };
}
