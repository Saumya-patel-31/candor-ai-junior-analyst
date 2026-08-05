import Link from "next/link";
import { FileText, ScanSearch, Gauge, Coins, ShieldCheck, FlaskConical, ArrowUpRight } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

export function FeatureBento() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <SectionHeading
        eyebrow="Why it's engineering, not a wrapper"
        title={<>The whole toolkit of an <span className="text-gradient-accent">AI engineer</span></>}
        description="Retrieval, structured output, an eval harness, cost budgets, and guardrails — the things a single API call can't fake."
      />

      <div className="mt-14 grid auto-rows-[minmax(0,1fr)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Big: grounded RAG */}
        <BentoCard className="sm:col-span-2 lg:row-span-2 lg:col-span-1" icon={FileText} title="Grounded in SEC filings">
          <p>
            Hybrid RAG over 10-K / 10-Q risk factors and MD&A, embedded into pgvector. Every metric,
            risk, and catalyst carries a citation id that traces back to the exact filing chunk.
          </p>
          <div className="mt-5 space-y-2">
            {["10-K · Item 1A", "10-Q · MD&A", "XBRL company facts", "Finnhub news"].map((s, i) => (
              <div
                key={s}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-line/60 bg-white/[0.02] px-3 py-2 font-mono text-2xs text-fg-dim",
                )}
              >
                <span className="text-accent-soft">[c{i + 1}]</span> {s}
              </div>
            ))}
          </div>
        </BentoCard>

        <BentoCard icon={ScanSearch} title="Self-critique pass">
          <p>
            A second reasoning-model call adversarially re-reads the draft and <span className="text-fg">deletes its own
            unsupported claims</span> before you ever see them — then lowers the confidence to match.
          </p>
        </BentoCard>

        <BentoCard icon={Gauge} title="Public calibration" href="/track-record">
          <p>
            Not "the AI picks winners." We track whether 80%-confidence calls actually resolve ~80% of the
            time — a real ML evaluation question: <span className="text-fg">does it know what it doesn't know?</span>
          </p>
        </BentoCard>

        <BentoCard icon={Coins} title="Cost engineering">
          <p>
            A fast model plans and routes; a larger one only synthesizes and critiques. Filing embeddings cache
            permanently, news on a short TTL. Every token is logged to Postgres from day one.
          </p>
        </BentoCard>

        <BentoCard icon={FlaskConical} title="Eval harness" href="/methodology">
          <p>
            A golden set of 30–50 questions plus an automated citation-accuracy checker that runs as CI on
            every prompt or retrieval change. The regression suite <span className="text-fg">is</span> the product.
          </p>
        </BentoCard>

        <BentoCard icon={ShieldCheck} title="Guardrails by design" className="sm:col-span-2 lg:col-span-1">
          <p>
            No "should I buy," no position sizing, no portfolio advice — refused at the door and scrubbed
            from output. A fixed disclaimer rides every memo. Framed as research, because it is.
          </p>
        </BentoCard>
      </div>
    </section>
  );
}

function BentoCard({
  icon: Icon,
  title,
  children,
  className,
  href,
}: {
  icon: typeof FileText;
  title: string;
  children: React.ReactNode;
  className?: string;
  href?: string;
}) {
  const inner = (
    <div className={cn("group relative h-full overflow-hidden rounded-3xl border border-line/70 bg-panel/40 p-6 card-hover")}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-accent-soft">
          <Icon className="h-5 w-5" />
        </div>
        {href && <ArrowUpRight className="h-4 w-4 text-fg-faint transition-colors group-hover:text-accent-soft" />}
      </div>
      <h3 className="font-display text-lg font-semibold text-fg">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-fg-muted [&_span]:text-fg">{children}</div>
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-accent/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
    </div>
  );
  return (
    <Reveal className={cn("h-full", className)}>
      {href ? (
        <Link href={href} className="block h-full cursor-pointer">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </Reveal>
  );
}
