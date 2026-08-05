"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Radar,
  PenTool,
  ShieldCheck,
  CheckCircle2,
  Database,
  FileText,
  Newspaper,
  ArrowRight,
  Loader2,
  CircleAlert,
  Sparkles,
  Terminal as TerminalIcon,
} from "lucide-react";
import type {
  CostTotals,
  Critique,
  MemoDraft,
  Memo,
  Phase,
  PipelineEvent,
  Plan,
  ToolName,
} from "@/lib/types";
import { MemoView } from "@/components/memo/MemoView";
import { Badge } from "@/components/ui/Badge";
import { cn, cost as fmtCost, ms, compact } from "@/lib/utils";

/* ── phases + tool metadata ──────────────────────────────────────────────── */
const PHASES: { key: Phase; label: string; icon: typeof Brain }[] = [
  { key: "planning", label: "Plan", icon: Brain },
  { key: "retrieving", label: "Retrieve", icon: Radar },
  { key: "synthesizing", label: "Synthesize", icon: PenTool },
  { key: "critiquing", label: "Self-critique", icon: ShieldCheck },
  { key: "finalizing", label: "Finalize", icon: CheckCircle2 },
];
const PHASE_ORDER: Phase[] = ["planning", "retrieving", "synthesizing", "critiquing", "finalizing", "done"];
const TOOL_ICON: Record<ToolName, typeof Database> = {
  get_fundamentals: Database,
  search_filings: FileText,
  get_recent_news: Newspaper,
};

const EXAMPLES = [
  { ticker: "NVDA", q: "Give me a research memo on NVDA." },
  { ticker: "DIS", q: "How exposed is DIS to streaming competition?" },
  { ticker: "TSLA", q: "Research memo on TSLA — focus on margins." },
];

/* ── state ───────────────────────────────────────────────────────────────── */
interface ToolState {
  id: string;
  tool: ToolName;
  rationale: string;
  lines: string[];
  status: "running" | "done";
  latencyMs?: number;
  summary?: string;
  citations?: number;
}
interface State {
  status: "idle" | "running" | "done" | "error";
  phase: Phase;
  statusMessage: string;
  interpretation: string;
  plan?: Plan;
  tools: ToolState[];
  synthThinking: string;
  critiqueThinking: string;
  draft?: MemoDraft;
  critique?: Critique;
  cost?: CostTotals;
  memo?: Memo;
  error?: string;
}
const initialState: State = {
  status: "idle",
  phase: "planning",
  statusMessage: "",
  interpretation: "",
  tools: [],
  synthThinking: "",
  critiqueThinking: "",
};

type Action = { type: "reset" } | { type: "event"; e: PipelineEvent };

function reducer(state: State, action: Action): State {
  if (action.type === "reset") return { ...initialState, status: "running" };
  const e = action.e;
  switch (e.type) {
    case "status":
      return { ...state, phase: e.phase, statusMessage: e.message };
    case "thinking":
      if (e.phase === "planning") return { ...state, interpretation: state.interpretation + e.delta };
      if (e.phase === "synthesizing") return { ...state, synthThinking: state.synthThinking + e.delta };
      if (e.phase === "critiquing") return { ...state, critiqueThinking: state.critiqueThinking + e.delta };
      return state;
    case "plan":
      return { ...state, plan: e.plan, interpretation: e.plan.interpretation };
    case "tool_start":
      return {
        ...state,
        tools: [
          ...state.tools,
          { id: e.call.id, tool: e.call.tool, rationale: e.call.rationale, lines: [], status: "running" },
        ],
      };
    case "tool_delta":
      return {
        ...state,
        tools: state.tools.map((t) => (t.id === e.id ? { ...t, lines: [...t.lines, e.line] } : t)),
      };
    case "tool_end":
      return {
        ...state,
        tools: state.tools.map((t) =>
          t.id === e.call.id
            ? { ...t, status: "done", latencyMs: e.call.latencyMs, summary: e.call.resultSummary, citations: e.call.citationsProduced }
            : t,
        ),
      };
    case "draft":
      return { ...state, draft: e.draft };
    case "critique":
      return { ...state, critique: e.critique };
    case "cost":
      return { ...state, cost: e.totals };
    case "final":
      return { ...state, memo: e.memo, phase: "done", status: "done" };
    case "error":
      return { ...state, error: e.message, status: "error" };
    case "done":
      return { ...state, status: state.status === "error" ? "error" : "done" };
    default:
      return state;
  }
}

/* ── component ───────────────────────────────────────────────────────────── */
export function AnalystTerminal({ autostart }: { autostart?: string }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const tickerRef = useRef<HTMLInputElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAuto = useRef(false);

  const run = useCallback(async (ticker: string, question: string) => {
    if (!ticker) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    dispatch({ type: "reset" });

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, question }),
        signal: ac.signal,
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const line = block.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const e = JSON.parse(line.slice(5).trim()) as PipelineEvent;
            dispatch({ type: "event", e });
          } catch {
            /* ignore malformed chunk */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        dispatch({ type: "event", e: { type: "error", message: (err as Error).message, ts: Date.now() } });
      }
    }
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = tickerRef.current?.value.trim().toUpperCase() ?? "";
    if (raw) run(raw, `Research memo on ${raw}.`);
  };

  // Auto-play once (the "reel" effect) on the landing hero.
  useEffect(() => {
    if (autostart && !startedAuto.current) {
      startedAuto.current = true;
      const ex = EXAMPLES.find((x) => x.ticker === autostart) ?? EXAMPLES[0];
      const t = setTimeout(() => run(ex.ticker, ex.q), 900);
      return () => clearTimeout(t);
    }
  }, [autostart, run]);

  // Auto-scroll the console while streaming.
  useEffect(() => {
    if (state.status === "running" && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [state]);

  const activeIdx = PHASE_ORDER.indexOf(state.phase);
  const running = state.status === "running";

  return (
    <div id="terminal" className="scroll-mt-24">
      {/* Terminal window */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-panel/70 backdrop-blur-2xl shadow-panel-lg">
        {/* running scanline */}
        {running && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-accent to-transparent animate-scan-y" />
        )}

        {/* Title bar */}
        <div className="flex items-center justify-between gap-3 border-b border-line/70 bg-white/[0.02] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-bear/70" />
              <span className="h-3 w-3 rounded-full bg-amber/70" />
              <span className="h-3 w-3 rounded-full bg-bull/70" />
            </div>
            <span className="hidden items-center gap-2 font-mono text-2xs text-fg-muted sm:flex">
              <TerminalIcon className="h-3.5 w-3.5" />
              candor://analyze
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill state={state} />
          </div>
        </div>

        {/* Input */}
        <form onSubmit={onSubmit} className="border-b border-line/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 focus-within:border-accent/50 focus-within:shadow-glow transition-all">
              <span className="font-mono text-sm text-accent-soft">$</span>
              <input
                ref={tickerRef}
                defaultValue={autostart ?? "NVDA"}
                placeholder="Enter a ticker — NVDA, DIS, TSLA…"
                maxLength={6}
                aria-label="Ticker symbol"
                className="w-full bg-transparent py-3 font-mono text-sm uppercase tracking-wide text-fg placeholder:text-fg-faint focus:outline-none"
              />
            </div>
            <button type="submit" disabled={running} className="btn-primary px-5 py-3 text-sm">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {running ? "Analyzing…" : "Run analysis"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-2xs text-fg-faint">try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.ticker}
                type="button"
                disabled={running}
                onClick={() => {
                  if (tickerRef.current) tickerRef.current.value = ex.ticker;
                  run(ex.ticker, ex.q);
                }}
                className="chip hover:border-accent/40 hover:text-accent-soft disabled:opacity-40 cursor-pointer transition-colors"
              >
                {ex.ticker}
              </button>
            ))}
          </div>
        </form>

        {/* Pipeline body */}
        <AnimatePresence>
          {state.status !== "idle" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="overflow-hidden"
            >
              {/* Phase stepper */}
              <div className="border-b border-line/70 px-4 py-4">
                <PhaseStepper activeIdx={activeIdx} status={state.status} />
              </div>

              {/* Console */}
              {!state.memo && !state.error && (
                <div
                  ref={consoleRef}
                  className="max-h-[440px] space-y-4 overflow-y-auto p-4 sm:p-5"
                >
                  <PlanningBlock state={state} />
                  <ToolsBlock state={state} />
                  <SynthBlock state={state} />
                  <CritiqueBlock state={state} />
                </div>
              )}

              {/* Error / refusal */}
              {state.error && (
                <div className="p-5">
                  <div className="flex items-start gap-3 rounded-2xl border border-amber/25 bg-amber/[0.05] p-4">
                    <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
                    <div>
                      <p className="text-sm font-medium text-fg">Guardrail engaged</p>
                      <p className="mt-1 text-sm text-fg-muted">{state.error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Live cost meter */}
              {state.cost && !state.memo && <LiveCost cost={state.cost} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Final memo */}
      <AnimatePresence>
        {state.memo && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-line" />
              <span className="flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.2em] text-bull">
                <CheckCircle2 className="h-4 w-4" /> memo finalized
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-line" />
            </div>
            <MemoView memo={state.memo} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── sub-blocks ──────────────────────────────────────────────────────────── */
function StatusPill({ state }: { state: State }) {
  if (state.status === "idle")
    return <span className="chip text-fg-muted">idle</span>;
  if (state.status === "error")
    return <Badge tone="amber">guardrail</Badge>;
  if (state.status === "done")
    return <Badge tone="bull">complete</Badge>;
  return (
    <span className="inline-flex items-center gap-2 font-mono text-2xs text-cyan-soft">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
      </span>
      {state.statusMessage || "working…"}
    </span>
  );
}

function PhaseStepper({ activeIdx, status }: { activeIdx: number; status: State["status"] }) {
  return (
    <div className="flex items-center">
      {PHASES.map((p, i) => {
        const done = i < activeIdx || status === "done";
        const active = i === activeIdx && status === "running";
        const Icon = p.icon;
        return (
          <div key={p.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-300",
                  done && "border-bull/40 bg-bull/10 text-bull",
                  active && "border-accent/50 bg-accent/15 text-accent-soft shadow-glow",
                  !done && !active && "border-line bg-white/[0.02] text-fg-faint",
                )}
              >
                {active ? <Icon className="h-4 w-4 animate-pulse-soft" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  "font-mono text-[0.6rem] uppercase tracking-[0.1em]",
                  done ? "text-bull/80" : active ? "text-accent-soft" : "text-fg-faint",
                )}
              >
                {p.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div className="mx-1 h-px flex-1 self-start mt-4 overflow-hidden bg-line">
                <motion.div
                  className="h-full bg-gradient-to-r from-bull to-accent"
                  initial={{ width: "0%" }}
                  animate={{ width: done ? "100%" : "0%" }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConsoleLabel({ children, icon: Icon }: { children: React.ReactNode; icon: typeof Brain }) {
  return (
    <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.16em] text-fg-muted">
      <Icon className="h-3.5 w-3.5 text-accent-soft" />
      {children}
    </div>
  );
}

function PlanningBlock({ state }: { state: State }) {
  if (!state.interpretation && !state.plan) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <ConsoleLabel icon={Brain}>planner · fast tier</ConsoleLabel>
      <p className="font-mono text-xs leading-relaxed text-fg-dim">
        {state.interpretation}
        {state.status === "running" && state.phase === "planning" && (
          <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-accent animate-blink" />
        )}
      </p>
      {state.plan && (
        <div className="grid gap-2 sm:grid-cols-2">
          {state.plan.steps.map((s, i) => {
            const Icon = TOOL_ICON[s.tool];
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-2.5 rounded-xl border border-line/70 bg-white/[0.02] p-3"
              >
                <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-accent/10">
                  <Icon className="h-3.5 w-3.5 text-accent-soft" />
                </div>
                <div className="min-w-0">
                  <span className="font-mono text-2xs text-fg">{s.tool}</span>
                  <p className="text-2xs leading-snug text-fg-muted">{s.rationale}</p>
                </div>
                {s.parallelGroup !== undefined && (
                  <span className="ml-auto shrink-0 font-mono text-[0.55rem] text-fg-faint">g{s.parallelGroup}</span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function ToolsBlock({ state }: { state: State }) {
  if (state.tools.length === 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <ConsoleLabel icon={Radar}>tool execution</ConsoleLabel>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {state.tools.map((t) => {
          const Icon = TOOL_ICON[t.tool];
          return (
            <motion.div
              key={t.id}
              layout
              className={cn(
                "rounded-xl border bg-white/[0.02] p-3 transition-colors",
                t.status === "done" ? "border-bull/25" : "border-accent/30 shadow-glow",
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4", t.status === "done" ? "text-bull" : "text-accent-soft")} />
                <span className="font-mono text-xs text-fg">{t.tool}</span>
                <span className="ml-auto">
                  {t.status === "done" ? (
                    <span className="font-mono text-2xs text-bull">{t.latencyMs}ms</span>
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-soft" />
                  )}
                </span>
              </div>
              <div className="mt-2 space-y-1 font-mono text-[0.65rem] leading-relaxed text-fg-muted">
                <AnimatePresence>
                  {t.lines.map((l, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-1.5"
                    >
                      <span className="text-accent-soft/60">›</span>
                      <span>{l}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {t.status === "done" && t.citations !== undefined && (
                <div className="mt-2 flex items-center gap-1.5 border-t border-line/60 pt-2">
                  <span className="font-mono text-[0.6rem] text-fg-faint">+{t.citations} citations</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function SynthBlock({ state }: { state: State }) {
  if (!state.synthThinking && !state.draft) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
      <ConsoleLabel icon={PenTool}>synthesizer · forced JSON</ConsoleLabel>
      <p className="font-mono text-xs leading-relaxed text-fg-dim">
        {state.synthThinking}
        {state.status === "running" && state.phase === "synthesizing" && (
          <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-violet animate-blink" />
        )}
      </p>
      {state.draft && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge tone="violet">draft · {state.draft.stance}</Badge>
          <Badge tone="neutral">{state.draft.keyMetrics.length} metrics</Badge>
          <Badge tone="neutral">{state.draft.risks.length} risks</Badge>
          <Badge tone="neutral">{state.draft.catalysts.length} catalysts</Badge>
          <Badge tone="amber">conf {state.draft.confidenceScore}</Badge>
        </div>
      )}
    </motion.div>
  );
}

function CritiqueBlock({ state }: { state: State }) {
  if (!state.critiqueThinking && !state.critique) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
      <ConsoleLabel icon={ShieldCheck}>self-critic · adversarial re-read</ConsoleLabel>
      <p className="font-mono text-xs leading-relaxed text-fg-dim">
        {state.critiqueThinking}
        {state.status === "running" && state.phase === "critiquing" && (
          <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-cyan animate-blink" />
        )}
      </p>
      {state.critique && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge tone={state.critique.verdict === "flagged" ? "bear" : "amber"}>
            {state.critique.verdict}
          </Badge>
          <Badge tone="neutral">
            {state.critique.supportedClaims}/{state.critique.totalClaims} claims supported
          </Badge>
          {state.critique.confidenceAdjustment !== 0 && (
            <Badge tone="amber">conf {state.critique.confidenceAdjustment}</Badge>
          )}
          {state.critique.unsupportedRemoved.length > 0 && (
            <Badge tone="bear">−{state.critique.unsupportedRemoved.length} unsupported</Badge>
          )}
        </div>
      )}
    </motion.div>
  );
}

function LiveCost({ cost }: { cost: CostTotals }) {
  const stats = [
    { label: "cost", value: fmtCost(cost.costUsd) },
    { label: "tokens", value: compact(cost.tokensIn + cost.tokensOut, 1) },
    { label: "latency", value: ms(cost.latencyMs) },
    { label: "tools", value: `${cost.toolCalls}` },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line/70 bg-white/[0.015] px-5 py-3">
      <span className="font-mono text-2xs uppercase tracking-[0.16em] text-fg-faint">live cost</span>
      {stats.map((s) => (
        <span key={s.label} className="flex items-baseline gap-1.5 font-mono text-2xs">
          <span className="text-fg-muted">{s.label}</span>
          <span className="text-fg tnum">{s.value}</span>
        </span>
      ))}
    </div>
  );
}
