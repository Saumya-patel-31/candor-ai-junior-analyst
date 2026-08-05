import { z } from "zod";
import { config } from "@/lib/config";
import { TOOL_NAMES, type Plan, type ToolName } from "@/lib/types";
import { callJSON, type CallUsage } from "./llm";
import { PLANNER_SYSTEM } from "./prompts";

const PlanStepSchema = z.object({
  id: z.string(),
  tool: z.enum([...TOOL_NAMES] as [ToolName, ...ToolName[]]),
  rationale: z.string(),
  query: z.string().optional(),
  dependsOn: z.array(z.string()).optional(),
  parallelGroup: z.number().optional(),
});
const PlanSchema = z.object({
  interpretation: z.string(),
  steps: z.array(PlanStepSchema).min(1),
});

export async function plan(ticker: string, question: string): Promise<{ plan: Plan; usage: CallUsage }> {
  const { data, usage } = await callJSON({
    model: config.models.planner,
    system: PLANNER_SYSTEM,
    user: `Ticker: ${ticker}\nQuestion: ${question}\n\nProduce the tool plan as JSON.`,
    schema: PlanSchema,
    maxTokens: 1024,
    temperature: 0.2,
  });
  return { plan: data, usage };
}
