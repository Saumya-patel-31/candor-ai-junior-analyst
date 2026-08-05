import type { Metadata } from "next";
import Link from "next/link";
import {
  Database,
  FileText,
  Newspaper,
  FlaskConical,
  ScanSearch,
  Gauge,
  ShieldCheck,
  Coins,
  Sparkles,
} from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How Candor plans, retrieves, cites, self-critiques, and scores its own calibration.",
};

const SOURCES = [
  { icon: FileText, name: "SEC EDGAR filings", detail: "10-K / 10-Q risk factors + MD&A, chunked & embedded into pgvector for hybrid RAG.", trust: "Highest", tone: "bull" },
  { icon: Database, name: "XBRL company facts", detail: "Structured revenue, margins, debt, FCF straight from data.sec.gov — no scraping.", trust: "Highest", tone: "bull" },
  { icon: Newspaper, name: "News", detail: "Finnhub / NewsAPI recent headlines, clustered into themes for current framing.", trust: "Medium", tone: "amber" },
];

const EVALS = [
  { icon: FlaskConical, title: "Golden set", desc: "30–50 ticker questions with a human-reviewed checklist — cites real filing data, names the top 2–3 known risks, confidence reasonable for the evidence quality." },
  { icon: ScanSearch, title: "Citation-accuracy CI", desc: "An automated checker verifies each cited claim actually appears (semantically) in the chunk it's attributed to. Runs on every prompt or retrieval change — the regression suite." },
  { icon: Gauge, title: "Calibration tracking", desc: "Confidence logged over time against later-observed outcomes. Reported as ECE + Brier + a reliability diagram — framed as calibration, never prediction accuracy." },
];

const MODELS = [
  { role: "Planner + tool routing", model: "Llama 3.1 8B", why: "Cheap and frequent — one call per query to choose tools.", tone: "accent" },
  { role: "Synthesizer", model: "Llama 3.3 70B", why: "Quality where it matters — the forced-JSON memo.", tone: "violet" },
  { role: "Self-critic", model: "Llama 3.3 70B", why: "Adversarial re-read that removes unsupported claims.", tone: "violet" },
];

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 pt-32 pb-16">
      <Reveal>
        <span className="chip mb-4 border-accent/20 text-accent-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Methodology
        </span>
        <h1 className="max-w-2xl font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
          How the sausage is <span className="text-gradient-accent">made — and checked.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-muted">
          Candor hand-rolls an agent loop against any OpenAI-compatible model: a planner decides the tool sequence, tools
          retrieve grounded evidence, a synthesizer writes a forced-JSON memo, and a self-critic tears it apart
          before you see it. Then the confidence gets logged for public calibration scoring.
        </p>
      </Reveal>

      {/* Data sources */}
      <Section title="Data sources" icon={Database}>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOURCES.map((s) => (
            <div key={s.name} className="rounded-2xl border border-line/70 bg-panel/40 p-5 card-hover">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-accent-soft">
                  <s.icon className="h-5 w-5" />
                </div>
                <Badge tone={s.tone}>{s.trust} trust</Badge>
              </div>
              <h3 className="mt-3 font-display text-base font-semibold text-fg">{s.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{s.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Eval harness */}
      <Section title="The eval harness" icon={FlaskConical}>
        <p className="mb-5 max-w-2xl text-sm text-fg-muted">
          Almost no student project ships this. It&apos;s built early, not bolted on — and it&apos;s the single most
          valuable artifact in the whole project.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {EVALS.map((e) => (
            <div key={e.title} className="rounded-2xl border border-line/70 bg-panel/40 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet/25 bg-violet/10 text-violet-soft">
                <e.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 font-display text-base font-semibold text-fg">{e.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{e.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Cost engineering */}
      <Section title="Cost & latency engineering" icon={Coins}>
        <div className="overflow-hidden rounded-2xl border border-line/70 bg-panel/40">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line/70 font-mono text-2xs uppercase tracking-[0.12em] text-fg-muted">
                <th className="px-5 py-3 font-normal">Stage</th>
                <th className="px-3 py-3 font-normal">Model</th>
                <th className="px-5 py-3 font-normal">Why</th>
              </tr>
            </thead>
            <tbody>
              {MODELS.map((m) => (
                <tr key={m.role} className="border-b border-line/50 last:border-0">
                  <td className="px-5 py-3.5 text-fg">{m.role}</td>
                  <td className="px-3 py-3.5">
                    <Badge tone={m.tone}>{m.model}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-fg-muted">{m.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-fg-muted">
          Filing embeddings cache permanently (10-Ks don&apos;t change); fundamentals + news cache on a short TTL.
          Every tool call&apos;s tokens + latency are logged to Postgres from day one — that table is the cost story.
        </p>
      </Section>

      {/* Guardrails */}
      <Section title="Guardrails & compliance" icon={ShieldCheck}>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            "System prompt hard-forbids 'should I buy/sell', position sizing, and portfolio-specific advice.",
            "Personalized-advice questions are refused at the door before any tokens are spent.",
            "A deterministic scrub rewrites any advice phrasing that slips through synthesis.",
            "A fixed disclaimer rides every memo; the track record is framed as a calibration experiment, never 'beats the market'.",
          ].map((g, i) => (
            <div key={i} className="flex gap-3 rounded-2xl border border-amber/20 bg-amber/[0.04] p-4">
              <span className="mt-0.5 font-mono text-2xs text-amber">0{i + 1}</span>
              <p className="text-sm leading-relaxed text-fg-muted">{g}</p>
            </div>
          ))}
        </div>
      </Section>

      <Reveal>
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/[0.08] bg-panel/50 p-8">
          <div>
            <h3 className="font-display text-xl font-semibold text-fg">See it run end-to-end</h3>
            <p className="mt-1 text-sm text-fg-muted">Watch the planner, tools, synthesizer, and critic work in real time.</p>
          </div>
          <Link href="/#terminal" className="btn-primary px-6 py-3 text-sm">
            <Sparkles className="h-4 w-4" /> Launch the terminal
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Database; children: React.ReactNode }) {
  return (
    <Reveal className="mt-14">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/[0.03] text-accent-soft">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-fg">{title}</h2>
      </div>
      {children}
    </Reveal>
  );
}
