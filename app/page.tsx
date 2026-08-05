import Link from "next/link";
import { ArrowUpRight, Sparkles, FileText } from "lucide-react";
import { AnalystTerminal } from "@/components/terminal/AnalystTerminal";
import { TickerTape } from "@/components/viz/TickerTape";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FeatureBento } from "@/components/landing/FeatureBento";
import { CalibrationTeaser } from "@/components/landing/CalibrationTeaser";
import { Reveal } from "@/components/ui/Reveal";
import { CALIBRATION_SUMMARY } from "@/lib/demo/mockCalibration";

export default function Home() {
  // Keep these honest — they are measured, not aspirational.
  // Cost is the observed live per-memo spend at provider list rates (actual
  // spend on the free tier is $0); ECE comes straight from the track record.
  const stats = [
    { k: "5", v: "agent stages" },
    { k: "<1¢", v: "per memo" },
    { k: `${CALIBRATION_SUMMARY.ece}`, v: "calibration error" },
    { k: "3", v: "grounded tools" },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative px-6 pt-32 sm:pt-40">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <span className="chip mb-6 border-white/10 text-fg-dim">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bull opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-bull" />
              </span>
              Autonomous equity research · <span className="text-amber">not investment advice</span>
            </span>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight text-fg sm:text-7xl">
              Research that
              <br />
              <span className="text-gradient">shows its work.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">
              Candor is an AI junior analyst that plans its own research, grounds every claim in SEC filings,
              critiques its own draft, and publishes a public record of how well-calibrated it actually is.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="#terminal" className="btn-primary px-6 py-3 text-sm">
                <Sparkles className="h-4 w-4" /> Run a live memo
              </Link>
              <Link href="/track-record" className="btn-ghost px-6 py-3 text-sm">
                <FileText className="h-4 w-4" /> See the track record
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.32}>
            <div className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.v} className="rounded-2xl border border-line/70 bg-panel/30 px-3 py-4">
                  <div className="font-display text-2xl font-semibold text-fg tnum">{s.k}</div>
                  <div className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-fg-muted">{s.v}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mx-auto mt-16 max-w-6xl">
          <TickerTape />
        </Reveal>

        {/* The terminal */}
        <div className="mx-auto mt-10 max-w-5xl">
          <AnalystTerminal autostart="NVDA" />
        </div>
      </section>

      <HowItWorks />
      <FeatureBento />
      <CalibrationTeaser />

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-6 py-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-4xl border border-white/[0.08] bg-gradient-to-b from-panel/70 to-panel/30 p-10 text-center sm:p-16">
            <div className="pointer-events-none absolute inset-0 bg-hud-grid opacity-30 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000,transparent)]" />
            <div className="relative">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                Point it at a ticker.
                <br />
                <span className="text-gradient-accent">Watch it reason.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-base text-fg-muted">
                No signup. Runs a fully scripted demo pipeline instantly — or wire a free key for live SEC + LLM retrieval.
              </p>
              <Link href="#terminal" className="btn-primary mx-auto mt-8 px-6 py-3 text-sm">
                <Sparkles className="h-4 w-4" /> Launch the terminal
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
