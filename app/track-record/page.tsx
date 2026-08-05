import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, TrendingDown } from "lucide-react";
import { getCalibrationSummary, listCalibrationRecords, calibrationEnabled } from "@/lib/calibration/store";
import { ReliabilityDiagram } from "@/components/charts/ReliabilityDiagram";
import { TrendChart } from "@/components/charts/TrendChart";
import { AnimatedNumber } from "@/components/viz/AnimatedNumber";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/Badge";
import { GridBackdrop } from "@/components/viz/GridBackdrop";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Calibration track record",
  description: "A public record of how well-calibrated Candor's confidence scores are over time.",
};

export default async function TrackRecordPage() {
  const [s, records] = await Promise.all([getCalibrationSummary(), listCalibrationRecords()]);
  const live = calibrationEnabled();
  const stats = [
    { label: "Memos", value: s.totalMemos, decimals: 0, tone: "text-fg" },
    { label: "Resolved", value: s.resolved, decimals: 0, tone: "text-fg" },
    { label: "ECE", value: s.ece, decimals: 3, tone: "text-accent-soft", hint: "expected calibration error ↓" },
    { label: "Brier", value: s.brierScore, decimals: 3, tone: "text-violet-soft", hint: "lower is better ↓" },
    { label: "Overconfidence", value: s.overconfidence, decimals: 3, tone: "text-amber", hint: "stated − observed" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 pt-32 pb-16">
      {/* Header */}
      <Reveal>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="chip border-violet/20 text-violet-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-violet" />
            Public calibration experiment
          </span>
          <Badge tone={live ? "cyan" : "neutral"}>{live ? "live data" : "demo data"}</Badge>
        </div>
        <h1 className="max-w-2xl font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
          The track record grades <span className="text-gradient-accent">itself.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-muted">
          Every published memo&apos;s confidence is logged and later scored against the observed directional
          outcome over its horizon. The question isn&apos;t &ldquo;did it win&rdquo; — it&apos;s whether an 80%
          call resolves right ~80% of the time. Candor is engineered to run <span className="text-fg">slightly
          overconfident</span>, and this page keeps it honest about that.
        </p>
      </Reveal>

      {/* Stat row */}
      <Reveal delay={0.1}>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((m) => (
            <div key={m.label} className="rounded-2xl border border-line/70 bg-panel/40 p-4">
              <div className={cn("font-display text-2xl font-semibold tnum", m.tone)}>
                <AnimatedNumber value={m.value} decimals={m.decimals} />
              </div>
              <div className="mt-1 font-mono text-2xs uppercase tracking-[0.12em] text-fg-muted">{m.label}</div>
              {m.hint && <div className="mt-0.5 text-[0.62rem] text-fg-faint">{m.hint}</div>}
            </div>
          ))}
        </div>
      </Reveal>

      {/* Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Reveal delay={0.15}>
          <div className="relative h-full overflow-hidden rounded-3xl border border-line/70 bg-panel/40 p-6">
            <GridBackdrop />
            <div className="relative">
              <h3 className="font-display text-lg font-semibold text-fg">Reliability diagram</h3>
              <p className="mt-1 text-sm text-fg-muted">Stated confidence vs. observed hit-rate. On the diagonal = perfectly calibrated.</p>
              <div className="mt-4 flex justify-center">
                <ReliabilityDiagram bins={s.bins} size={380} />
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="relative h-full overflow-hidden rounded-3xl border border-line/70 bg-panel/40 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-fg">Calibration over time</h3>
                <p className="mt-1 text-sm text-fg-muted">ECE (solid) and Brier (dashed) as the eval harness tightened prompts + retrieval.</p>
              </div>
              <Badge tone="bull" className="shrink-0">
                <TrendingDown className="h-3 w-3" /> improving
              </Badge>
            </div>
            <div className="mt-6">
              <TrendChart data={s.trend} />
            </div>
          </div>
        </Reveal>
      </div>

      {/* Records table */}
      <Reveal delay={0.1}>
        <div className="mt-6 overflow-hidden rounded-3xl border border-line/70 bg-panel/40">
          <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
            <h3 className="font-display text-lg font-semibold text-fg">Scored memos</h3>
            <span className="font-mono text-2xs text-fg-faint">{records.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-line/70 font-mono text-2xs uppercase tracking-[0.12em] text-fg-muted">
                  <th className="px-5 py-3 font-normal">Ticker</th>
                  <th className="px-3 py-3 font-normal">Question</th>
                  <th className="px-3 py-3 font-normal">Confidence</th>
                  <th className="px-3 py-3 font-normal">Horizon</th>
                  <th className="px-3 py-3 font-normal">As of</th>
                  <th className="px-5 py-3 font-normal text-right">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.memoId} className="border-b border-line/50 text-sm transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <Link href={`/memo/${r.memoId}`} className="font-display font-semibold text-fg hover:text-accent-soft cursor-pointer">
                        {r.ticker}
                      </Link>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-3 text-fg-muted">{r.question}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-accent to-cyan"
                            style={{ width: `${r.confidenceScore}%` }}
                          />
                        </div>
                        <span className="font-mono text-2xs text-fg-dim tnum">{r.confidenceScore}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-2xs text-fg-muted">{r.horizonDays}d</td>
                    <td className="px-3 py-3 font-mono text-2xs text-fg-muted">{formatDate(r.asOf)}</td>
                    <td className="px-5 py-3 text-right">
                      {!r.resolved ? (
                        <Badge tone="neutral">pending</Badge>
                      ) : r.correct ? (
                        <Badge tone="bull">held</Badge>
                      ) : (
                        <Badge tone="bear">missed</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/70 bg-white/[0.015] p-5">
          <p className="max-w-xl text-xs leading-relaxed text-fg-muted">
            <span className="text-amber">Methodology note — </span>
            &ldquo;Held / missed&rdquo; scores the memo&apos;s directional read over its stated horizon, not price return.
            This is a calibration measure, framed explicitly as a model-evaluation experiment — never as a claim to
            beat the market.
          </p>
          <Link href="/methodology" className="btn-ghost px-4 py-2.5 text-sm">
            How scoring works <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
