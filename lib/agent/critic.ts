import { config } from "@/lib/config";
import { CritiqueSchema, type Critique, type MemoDraft } from "@/lib/types";
import type { ToolResult } from "@/lib/tools";
import { callJSON, type CallUsage } from "./llm";
import { CRITIC_SYSTEM } from "./prompts";

export async function critique(
  draft: MemoDraft,
  results: ToolResult[],
): Promise<{ critique: Critique; usage: CallUsage }> {
  const citationIndex = results
    .flatMap((r) => r.citations)
    .map((c) => `- [${c.id}] ${c.title}: "${c.snippet}"`)
    .join("\n");

  const { data, usage } = await callJSON({
    model: config.modelOverrides.critic,
    tier: "synth",
    system: CRITIC_SYSTEM,
    user: `DRAFT MEMO (JSON):\n${JSON.stringify(draft, null, 2)}\n\nEVIDENCE CITATIONS AVAILABLE:\n${citationIndex}\n\nAdversarially critique the draft against this evidence only. Respond as JSON.`,
    schema: CritiqueSchema,
    maxTokens: 2048,
    temperature: 0.3,
  });
  return { critique: data, usage };
}
