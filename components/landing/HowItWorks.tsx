import { Brain, Radar, PenTool, ShieldCheck, Activity } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/Badge";

const STAGES = [
  { icon: Brain, tier: "fast tier", title: "Plan", desc: "Reads the question and decides which tools to call, and in what order — an agent, not a hardcoded pipeline." },
  { icon: Radar, tier: "3 tools", title: "Retrieve", desc: "Fundamentals (XBRL), filing RAG (10-K/10-Q), and news — run in parallel, each logged for cost + latency." },
  { icon: PenTool, tier: "reasoning tier", title: "Synthesize", desc: "Writes a forced-JSON memo: thesis, metrics, risks, catalysts, confidence — every claim tagged with a citation id." },
  { icon: ShieldCheck, tier: "reasoning tier", title: "Self-critique", desc: "Adversarially re-reads the draft against the evidence, deletes unsupported claims, and adjusts the confidence score." },
  { icon: Activity, tier: "deterministic", title: "Guardrail + log", desc: "Scrubs advice phrasing, injects the disclaimer, and logs the confidence to the public calibration record." },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <SectionHeading
        eyebrow="The loop"
        title={<>Five stages. <span className="text-gradient-accent">One honest memo.</span></>}
        description="Candor hand-rolls the agent loop against any OpenAI-compatible model — no framework magic. Each stage is observable, logged, and swappable."
      />

      <div className="mt-14 grid gap-4 lg:grid-cols-5">
        {STAGES.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.08}>
            <div className="group relative h-full rounded-2xl border border-line/70 bg-panel/40 p-5 card-hover">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent-soft">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="font-mono text-2xs text-fg-faint">0{i + 1}</span>
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold text-fg">{s.title}</h3>
              </div>
              <Badge tone="neutral" className="mt-2">{s.tier}</Badge>
              <p className="mt-3 text-sm leading-relaxed text-fg-muted">{s.desc}</p>

              {/* connector arrow on desktop */}
              {i < STAGES.length - 1 && (
                <div className="absolute -right-2 top-1/2 hidden h-px w-4 bg-gradient-to-r from-accent/50 to-transparent lg:block" />
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
