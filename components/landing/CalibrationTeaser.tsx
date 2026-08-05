import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CALIBRATION_SUMMARY } from "@/lib/demo/mockCalibration";
import { ReliabilityDiagram } from "@/components/charts/ReliabilityDiagram";
import { AnimatedNumber } from "@/components/viz/AnimatedNumber";
import { Reveal } from "@/components/ui/Reveal";
import { GridBackdrop } from "@/components/viz/GridBackdrop";

export function CalibrationTeaser() {
  const s = CALIBRATION_SUMMARY;
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="relative overflow-hidden rounded-4xl border border-white/[0.07] bg-panel/40 p-8 sm:p-12">
        <GridBackdrop />
        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <span className="chip mb-4 border-violet/20 text-violet-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-violet" />
              The differentiator
            </span>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
              Does it know what it <span className="text-gradient-accent">doesn&apos;t know?</span>
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-fg-muted">
              Every memo&apos;s confidence is logged and scored against later-observed outcomes. A well-calibrated
              model&apos;s 70%-confidence calls should resolve correct about 70% of the time. This is calibration —
              a respected ML evaluation question — <span className="text-fg">not</span> a claim to beat the market.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { label: "ECE", value: s.ece, decimals: 3, hint: "expected calibration error" },
                { label: "Brier", value: s.brierScore, decimals: 3, hint: "lower is better" },
                { label: "Resolved", value: s.resolved, decimals: 0, hint: "scored memos" },
              ].map((m) => (
                <div key={m.label} className="rounded-2xl border border-line/70 bg-white/[0.02] p-4">
                  <div className="font-display text-2xl font-semibold text-fg tnum">
                    <AnimatedNumber value={m.value} decimals={m.decimals} />
                  </div>
                  <div className="mt-1 font-mono text-2xs uppercase tracking-[0.12em] text-fg-muted">{m.label}</div>
                  <div className="mt-0.5 text-[0.65rem] text-fg-faint">{m.hint}</div>
                </div>
              ))}
            </div>

            <Link href="/track-record" className="btn-ghost mt-8 px-5 py-3 text-sm">
              See the full track record
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Reveal>

          <Reveal delay={0.15} className="flex justify-center">
            <div className="rounded-3xl border border-line/70 bg-void/60 p-6">
              <ReliabilityDiagram bins={s.bins} />
              <div className="mt-3 flex items-center justify-center gap-5 font-mono text-2xs text-fg-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded bg-[#34D399]" /> well-calibrated
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded bg-[#FBBF24]" /> overconfident
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
