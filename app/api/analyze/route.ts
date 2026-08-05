import { NextRequest } from "next/server";
import { config, resolveMode } from "@/lib/config";
import type { PipelineEvent } from "@/lib/types";
import { streamDemoPipeline } from "@/lib/demo/pipeline";
import { runLivePipeline } from "@/lib/agent/orchestrator";
import { checkQuestionAllowed } from "@/lib/agent/guardrails";
import { checkRateLimit, clientKey } from "@/lib/ratelimit";
import { UNIVERSE } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Serverless functions default to 10s — a live memo (plan → 3 tools → synthesis →
// self-critique, plus free-tier rate-limit backoff) needs far more than that.
// 60s is the Hobby-plan ceiling; the demo pipeline finishes in ~8s regardless.
export const maxDuration = 60;

const enc = new TextEncoder();
const sse = (event: PipelineEvent | { type: string; [k: string]: unknown }) =>
  enc.encode(`data: ${JSON.stringify(event)}\n\n`);

export async function POST(req: NextRequest) {
  let body: { ticker?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const ticker = String(body.ticker ?? "").toUpperCase().replace(/[^A-Z.]/g, "").slice(0, 6);
  const question = String(body.question ?? `Research memo on ${ticker}.`).slice(0, 300);

  if (!ticker) return new Response("Missing ticker", { status: 400 });

  // Internal tools (eval harness, CI) bypass the public rate limit with the
  // shared secret. Never bypasses guardrails — only the abuse throttle.
  const internalSecret = process.env.CRON_SECRET;
  const isInternal = Boolean(internalSecret) && req.headers.get("x-candor-internal") === internalSecret;

  // Rate limit BEFORE any model/tool spend.
  const verdict = isInternal
    ? { allowed: true as const, remaining: -1, reason: undefined, retryAfterSec: undefined }
    : checkRateLimit(clientKey(req.headers));
  if (!verdict.allowed) {
    return new Response(JSON.stringify({ error: verdict.reason }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(verdict.retryAfterSec ?? 60),
      },
    });
  }

  // Coverage check — live tools need a CIK, so fail fast with a helpful message.
  const covered = ticker in UNIVERSE;
  const mode = resolveMode();
  if (!covered && mode === "live") {
    return new Response(
      JSON.stringify({
        error: `${ticker} isn't in the coverage universe yet. Covered: ${Object.keys(UNIVERSE).join(", ")}.`,
      }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  // Guardrail pre-flight — refuse personalized-advice questions before spending tokens.
  const gate = checkQuestionAllowed(question);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: PipelineEvent | { type: string; [k: string]: unknown }) => controller.enqueue(sse(e));
      try {
        if (!gate.allowed) {
          send({ type: "error", message: gate.reason!, ts: Date.now() });
          send({ type: "done", ts: Date.now() });
          controller.close();
          return;
        }

        send({ type: "status", phase: "planning", message: `mode=${mode} · killSwitch=${config.killSwitch}`, ts: Date.now() } as PipelineEvent);

        const gen = mode === "live" ? runLivePipeline(ticker, question) : streamDemoPipeline(ticker, question);
        for await (const event of gen) {
          send(event);
        }
      } catch (err) {
        send({ type: "error", message: (err as Error).message ?? "pipeline failed", ts: Date.now() });
        // Bulletproof fallback: if live fails, replay the scripted demo so the UI never dead-ends.
        try {
          for await (const event of streamDemoPipeline(ticker, question)) send(event);
        } catch {
          /* give up quietly */
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
