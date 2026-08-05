import type { Metadata } from "next";
import { Coins, Timer, Cpu, Gauge, Layers, Wrench } from "lucide-react";
import { getCostSummary } from "@/lib/analytics/costs";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/Badge";
import { AnimatedNumber } from "@/components/viz/AnimatedNumber";
import { BarChart } from "@/components/charts/BarChart";
import { cn, cost as fmtCost, usd, compact } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cost & latency dashboard",
  description: "Per-memo cost, token, and latency engineering — routing across a fast and a reasoning tier.",
};

const shortTool = (t: string) => t.replace("get_", "").replace("_", " ");
const isFastTier = (id: string) => /8b|instant|lite|mini|flash-lite/i.test(id);
function shortModel(id: string): string {
  const s = id.toLowerCase();
  if (s.includes("8b") || s.includes("instant")) return "Llama 3.1 8B";
  if (s.includes("70b")) return "Llama 3.3 70B";
  if (s.includes("flash-lite")) return "Gemini Flash-Lite";
  if (s.includes("flash")) return "Gemini Flash";
  if (s.includes("llama3")) return "Llama 3.1 (local)";
  return id;
}

export default async function DashboardPage() {
  const s = await getCostSummary();
  const spendMax = Math.max(...s.byModel.map((m) => m.costUsd), 0.0001);

  const stats = [
    { icon: Coins, label: "Total spend", node: <AnimatedNumber value={s.totalSpend} decimals={2} prefix="$" /> },
    { icon: Layers, label: "Memos", node: <AnimatedNumber value={s.memoCount} /> },
    { icon: Coins, label: "Avg / memo", node: <span>{fmtCost(s.avgCostPerMemo)}</span> },
    { icon: Timer, label: "Avg latency", node: <AnimatedNumber value={s.avgLatencyMs / 1000} decimals={2} suffix="s" /> },
    { icon: Gauge, label: "p95 latency", node: <AnimatedNumber value={s.p95LatencyMs / 1000} decimals={2} suffix="s" /> },
    { icon: Cpu, label: "Tokens", node: <AnimatedNumber value={s.totalTokens / 1000} decimals={0} suffix="K" /> },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 pt-32 pb-16">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip border-accent/20 text-accent-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Cost &amp; latency engineering
          </span>
          <Badge tone={s.live ? "cyan" : "neutral"}>{s.live ? "live data" : "demo data"}</Badge>
        </div>
        <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
          Every token is <span className="text-gradient-accent">accounted for.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-muted">
          Planning routes to a fast model; synthesis and self-critique route to a larger one. Every tool call&apos;s
          tokens and latency are logged from day one. Cost is a reference estimate at list rates — on the free tier
          your actual spend is $0.
        </p>
      </Reveal>

      {/* Stat row */}
      <Reveal delay={0.08}>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((m) => (
            <div key={m.label} className="rounded-2xl border border-line/70 bg-panel/40 p-4">
              <m.icon className="h-4 w-4 text-accent-soft" />
              <div className="mt-2 font-display text-2xl font-semibold text-fg tnum">{m.node}</div>
              <div className="mt-0.5 font-mono text-2xs uppercase tracking-[0.1em] text-fg-muted">{m.label}</div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Reveal delay={0.12}>
          <div className="h-full rounded-3xl border border-line/70 bg-panel/40 p-6">
            <h3 className="font-display text-lg font-semibold text-fg">Spend over time</h3>
            <p className="mt-1 text-sm text-fg-muted">Daily cost across all memos (last 30 days).</p>
            <div className="mt-5">
              <BarChart
                data={s.spendSeries.map((d) => ({ label: d.date.slice(5), value: Number(d.costUsd.toFixed(3)) }))}
                everyNthLabel={5}
                color="#5B8CFF"
              />
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.16}>
          <div className="h-full rounded-3xl border border-line/70 bg-panel/40 p-6">
            <h3 className="font-display text-lg font-semibold text-fg">Latency distribution</h3>
            <p className="mt-1 text-sm text-fg-muted">End-to-end memo latency, bucketed.</p>
            <div className="mt-5">
              <BarChart data={s.latencyBuckets.map((b) => ({ label: b.bucket, value: b.count }))} showValues color="#3DE0E6" />
            </div>
          </div>
        </Reveal>
      </div>

      {/* Model routing */}
      <Reveal delay={0.1}>
        <div className="mt-6 overflow-hidden rounded-3xl border border-line/70 bg-panel/40">
          <div className="flex items-center gap-2 border-b border-line/70 px-5 py-4">
            <Layers className="h-4 w-4 text-violet-soft" />
            <h3 className="font-display text-lg font-semibold text-fg">Model routing</h3>
            <span className="ml-2 font-mono text-2xs text-fg-faint">where the money goes</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line/70 font-mono text-2xs uppercase tracking-[0.12em] text-fg-muted">
                  <th className="px-5 py-3 font-normal">Model</th>
                  <th className="px-3 py-3 font-normal">Calls</th>
                  <th className="px-3 py-3 font-normal">Tokens</th>
                  <th className="px-3 py-3 font-normal">Cost</th>
                  <th className="px-5 py-3 font-normal">Share of spend</th>
                </tr>
              </thead>
              <tbody>
                {s.byModel.map((m) => {
                  const fast = isFastTier(m.model);
                  const short = shortModel(m.model);
                  return (
                    <tr key={m.model} className="border-b border-line/50 last:border-0">
                      <td className="px-5 py-3.5">
                        <Badge tone={fast ? "accent" : "violet"}>{short}</Badge>
                        <span className="ml-2 font-mono text-2xs text-fg-faint">{fast ? "plan · route" : "synth · critique"}</span>
                      </td>
                      <td className="px-3 py-3.5 font-mono text-fg-dim tnum">{m.calls}</td>
                      <td className="px-3 py-3.5 font-mono text-fg-dim tnum">{compact(m.tokensIn + m.tokensOut, 1)}</td>
                      <td className="px-3 py-3.5 font-mono text-fg tnum">{usd(m.costUsd, { digits: 2 })}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className={cn("h-full rounded-full", fast ? "bg-accent" : "bg-violet")}
                              style={{ width: `${(m.costUsd / spendMax) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-2xs text-fg-muted tnum">
                            {((m.costUsd / s.totalSpend) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      {/* Tool latency */}
      <Reveal delay={0.1}>
        <div className="mt-6 rounded-3xl border border-line/70 bg-panel/40 p-6">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-accent-soft" />
            <h3 className="font-display text-lg font-semibold text-fg">Tool latency</h3>
            <span className="ml-2 font-mono text-2xs text-fg-faint">avg ms per call</span>
          </div>
          <div className="mt-5">
            <BarChart
              data={s.byTool.map((t) => ({ label: shortTool(t.tool), value: Math.round(t.avgLatencyMs) }))}
              showValues
              valueSuffix=""
              color="#9A6BFF"
            />
          </div>
        </div>
      </Reveal>
    </div>
  );
}
