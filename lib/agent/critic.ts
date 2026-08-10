import { config } from "@/lib/config";
import { CritiqueSchema, type Critique, type MemoDraft } from "@/lib/types";
import type { ToolResult } from "@/lib/tools";
import { callJSON, type CallUsage } from "./llm";
import { CRITIC_SYSTEM } from "./prompts";

export async function critique(
  draft: MemoDraft,
  results: ToolResult[],
): Promise<{ critique: Critique; usage: CallUsage }> {
  // Send a compact view, not the raw draft. Pretty-printed JSON plus untruncated
  // snippets cost ~1k tokens per memo in indentation and fields the critic never
  // judges (raw values, trend flags, ids). It only needs each claim's text and
  // which sources it leans on.
  const cut = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n).trimEnd()}…`);

  const citationIndex = results
    .flatMap((r) => r.citations)
    .map((c) => `[${c.id}] ${c.title}: "${cut(c.snippet, 200)}"`)
    .join("\n");

  const claims = [
    `THESIS: ${draft.thesis}`,
    `STANCE: ${draft.stance} · CONFIDENCE: ${draft.confidenceScore} (${cut(draft.confidenceRationale, 300)})`,
    ...draft.keyMetrics.map((m) => `METRIC: ${m.label} = ${m.value}${m.commentary ? ` — ${m.commentary}` : ""} [${m.citationId ?? "uncited"}]`),
    ...draft.risks.map((r) => `RISK (${r.severity}): ${r.title} — ${r.detail} [${r.citationIds.join(",") || "uncited"}]`),
    ...draft.catalysts.map((c) => `CATALYST (${c.likelihood}): ${c.title} — ${c.detail} [${c.citationIds.join(",") || "uncited"}]`),
  ].join("\n");

  const { data, usage } = await callJSON({
    model: config.modelOverrides.critic,
    tier: "synth",
    system: CRITIC_SYSTEM,
    user: `DRAFT CLAIMS:\n${claims}\n\nEVIDENCE AVAILABLE:\n${citationIndex}\n\nAdversarially critique the draft against this evidence only. Respond as JSON.`,
    schema: CritiqueSchema,
    maxTokens: 2048,
    temperature: 0.3,
  });
  return { critique: data, usage };
}
