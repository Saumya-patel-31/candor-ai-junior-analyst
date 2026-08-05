"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Zap,
  FileText,
  Newspaper,
  Database,
  LineChart,
  ShieldCheck,
  ScanSearch,
  Coins,
  Timer,
  Cpu,
  Hash,
} from "lucide-react";
import type { Memo, Citation, Metric, SourceKind } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Gauge } from "@/components/charts/Gauge";
import { cn, pct, cost as fmtCost, ms, compact, formatDate } from "@/lib/utils";

const STANCE_TONE: Record<Memo["stance"], string> = {
  constructive: "bull",
  cautious: "amber",
  mixed: "violet",
  neutral: "neutral",
};
const SEVERITY_TONE = { high: "bear", medium: "amber", low: "neutral" } as const;
const LIKELIHOOD_TONE = { high: "bull", medium: "accent", low: "neutral" } as const;
const VERDICT_TONE = { passed: "bull", revised: "amber", flagged: "bear" } as const;

const KIND_ICON: Record<SourceKind, typeof FileText> = {
  "10-K": FileText,
  "10-Q": FileText,
  XBRL: Database,
  news: Newspaper,
  market: LineChart,
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function TrendIcon({ trend }: { trend?: Metric["trend"] }) {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-bull" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-bear" />;
  return <Minus className="h-3.5 w-3.5 text-fg-muted" />;
}

function CiteRef({ ids }: { ids: string[] }) {
  if (!ids?.length) return null;
  return (
    <span className="ml-1 inline-flex gap-1 align-super">
      {ids.map((id) => (
        <a
          key={id}
          href={`#cite-${id}`}
          className="rounded bg-accent/15 px-1 font-mono text-[0.6rem] text-accent-soft hover:bg-accent/30 cursor-pointer transition-colors"
        >
          {id}
        </a>
      ))}
    </span>
  );
}

export function MemoView({ memo, index = false }: { memo: Memo; index?: boolean }) {
  const preScore = memo.confidenceScore - memo.critique.confidenceAdjustment;

  return (
    <motion.article
      variants={stagger}
      initial="hidden"
      animate="show"
      className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-panel/60 backdrop-blur-xl shadow-panel-lg"
    >
      {/* Header */}
      <motion.header
        variants={item}
        className="relative border-b border-line/70 bg-gradient-to-b from-white/[0.03] to-transparent p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-fg">{memo.ticker}</h2>
              <Badge tone={STANCE_TONE[memo.stance]}>{memo.stance}</Badge>
              <Badge tone={memo.mode === "live" ? "cyan" : "neutral"}>{memo.mode}</Badge>
            </div>
            <p className="mt-1 text-sm text-fg-dim">
              {memo.company} · <span className="text-fg-muted">{memo.sector}</span>
            </p>
            <p className="mt-3 max-w-xl text-sm text-fg-muted">
              <span className="font-mono text-2xs uppercase tracking-[0.16em] text-fg-faint">query · </span>
              {memo.question}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-center">
            <Gauge value={memo.confidenceScore} size={200} sublabel="confidence" />
            <p className="mt-1 font-mono text-2xs text-fg-faint">
              as of {formatDate(memo.asOf)}
            </p>
          </div>
        </div>
      </motion.header>

      <div className="space-y-8 p-6 sm:p-8">
        {/* Thesis */}
        <motion.section variants={item}>
          <SectionLabel icon={ScanSearch}>Thesis</SectionLabel>
          <p className="mt-3 text-[0.98rem] leading-relaxed text-fg-dim">{memo.thesis}</p>
          <div className="mt-4 rounded-2xl border border-line/70 bg-white/[0.015] p-4">
            <div className="flex items-center gap-2">
              <span className="eyebrow">Confidence rationale</span>
              {memo.critique.confidenceAdjustment !== 0 && (
                <span className="font-mono text-2xs text-fg-muted">
                  <span className="text-fg-faint">{preScore}</span>
                  <span className="mx-1">→</span>
                  <span className="text-amber">{memo.confidenceScore}</span>
                  <span className="ml-1 text-fg-faint">after self-critique</span>
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{memo.confidenceRationale}</p>
          </div>
        </motion.section>

        {/* Key metrics */}
        <motion.section variants={item}>
          <SectionLabel icon={Hash}>Key metrics</SectionLabel>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {memo.keyMetrics.map((m) => (
              <div key={m.label} className="card-hover rounded-2xl border border-line/70 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xs uppercase tracking-[0.14em] text-fg-muted">{m.label}</span>
                  <TrendIcon trend={m.trend} />
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="font-display text-xl font-semibold text-fg tnum">{m.value}</span>
                  {typeof m.delta === "number" && (
                    <span className={cn("font-mono text-2xs tnum", m.delta >= 0 ? "text-bull" : "text-bear")}>
                      {pct(m.delta)}
                    </span>
                  )}
                </div>
                {m.commentary && (
                  <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                    {m.commentary}
                    {m.citationId && <CiteRef ids={[m.citationId]} />}
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.section>

        {/* Risks + Catalysts */}
        <motion.section variants={item} className="grid gap-6 lg:grid-cols-2">
          <div>
            <SectionLabel icon={AlertTriangle} tone="text-bear">Risks</SectionLabel>
            <ul className="mt-3 space-y-3">
              {memo.risks.map((r) => (
                <li key={r.id} className="rounded-2xl border border-line/70 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-fg">{r.title}</h4>
                    <Badge tone={SEVERITY_TONE[r.severity]}>{r.severity}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
                    {r.detail}
                    <CiteRef ids={r.citationIds} />
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionLabel icon={Zap} tone="text-bull">Catalysts</SectionLabel>
            <ul className="mt-3 space-y-3">
              {memo.catalysts.map((c) => (
                <li key={c.id} className="rounded-2xl border border-line/70 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-fg">{c.title}</h4>
                    <Badge tone={LIKELIHOOD_TONE[c.likelihood]}>{c.likelihood}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
                    {c.detail}
                    <CiteRef ids={c.citationIds} />
                  </p>
                  {c.horizon && (
                    <p className="mt-2 font-mono text-2xs text-fg-faint">horizon · {c.horizon}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </motion.section>

        {/* Self-critique */}
        <motion.section variants={item}>
          <CritiquePanel memo={memo} />
        </motion.section>

        {/* Citations */}
        <motion.section variants={item}>
          <SectionLabel icon={FileText}>
            Citations <span className="ml-1 text-fg-faint">· {memo.citations.length}</span>
          </SectionLabel>
          <div className="mt-3 grid gap-2.5">
            {memo.citations.map((c) => (
              <CitationRow key={c.id} c={c} />
            ))}
          </div>
        </motion.section>

        {/* Cost / telemetry */}
        {!index && (
          <motion.section variants={item}>
            <CostStrip memo={memo} />
          </motion.section>
        )}

        {/* Disclaimer */}
        <motion.section variants={item}>
          <div className="flex gap-3 rounded-2xl border border-amber/20 bg-amber/[0.04] p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
            <p className="text-xs leading-relaxed text-fg-muted">{memo.disclaimer}</p>
          </div>
        </motion.section>
      </div>
    </motion.article>
  );
}

function SectionLabel({
  children,
  icon: Icon,
  tone = "text-accent-soft",
}: {
  children: React.ReactNode;
  icon: typeof FileText;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={cn("h-4 w-4", tone)} />
      <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-fg-dim">{children}</h3>
    </div>
  );
}

function CitationRow({ c }: { c: Citation }) {
  const Icon = KIND_ICON[c.kind];
  return (
    <div
      id={`cite-${c.id}`}
      className="card-hover scroll-mt-24 rounded-2xl border border-line/70 bg-white/[0.02] p-4"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white/[0.03]">
          <Icon className="h-4 w-4 text-accent-soft" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-2xs text-accent-soft">[{c.id}]</span>
            <Badge tone="neutral">{c.kind}</Badge>
            <span className="truncate text-sm font-medium text-fg">{c.title}</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">“{c.snippet}”</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-2xs text-fg-faint">
            {c.locator && <span>{c.locator}</span>}
            {c.filedAt && <span>filed {c.filedAt}</span>}
            {c.url && (
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="text-accent-soft hover:underline cursor-pointer"
              >
                source ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CritiquePanel({ memo }: { memo: Memo }) {
  const c = memo.critique;
  const ratio = c.totalClaims ? c.supportedClaims / c.totalClaims : 1;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet/20 bg-violet/[0.04] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionLabel icon={ScanSearch} tone="text-violet-soft">
          Self-critique pass
        </SectionLabel>
        <Badge tone={VERDICT_TONE[c.verdict]}>{c.verdict}</Badge>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="flex items-center justify-between text-2xs">
            <span className="font-mono uppercase tracking-[0.14em] text-fg-muted">claims with live citation</span>
            <span className="font-mono text-fg-dim tnum">
              {c.supportedClaims}/{c.totalClaims}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${ratio * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-violet to-accent"
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-fg-muted">{c.notes}</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-line/70 bg-white/[0.02] px-5 py-3">
          <span className="font-mono text-2xs uppercase tracking-[0.14em] text-fg-muted">conf. adj.</span>
          <span
            className={cn(
              "font-display text-2xl font-semibold tnum",
              c.confidenceAdjustment < 0 ? "text-amber" : "text-bull",
            )}
          >
            {c.confidenceAdjustment > 0 ? "+" : ""}
            {c.confidenceAdjustment}
          </span>
        </div>
      </div>

      {c.unsupportedRemoved.length > 0 && (
        <div className="mt-4">
          <span className="eyebrow text-bear/80">Removed — unsupported</span>
          <ul className="mt-2 space-y-2">
            {c.unsupportedRemoved.map((u, i) => (
              <li key={i} className="rounded-lg border border-line/70 bg-white/[0.02] p-3 text-xs">
                <span className="text-fg-dim line-through decoration-bear/50">“{u.claim}”</span>
                <span className="mt-1 block text-fg-muted">↳ {u.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.contradictions.length > 0 && (
        <div className="mt-4">
          <span className="eyebrow text-amber/80">Contradicting evidence addressed</span>
          <ul className="mt-2 space-y-2">
            {c.contradictions.map((x, i) => (
              <li key={i} className="rounded-lg border border-line/70 bg-white/[0.02] p-3 text-xs text-fg-muted">
                {x.claim} <span className="text-fg-faint">— vs —</span> {x.evidence}
                {x.citationId && <CiteRef ids={[x.citationId]} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CostStrip({ memo }: { memo: Memo }) {
  const c = memo.cost;
  const stats = [
    { icon: Coins, label: "cost", value: fmtCost(c.costUsd) },
    { icon: Cpu, label: "tokens", value: `${compact(c.tokensIn + c.tokensOut, 1)}` },
    { icon: Timer, label: "latency", value: ms(c.latencyMs) },
    { icon: Database, label: "tool calls", value: `${c.toolCalls}` },
  ];
  return (
    <div className="rounded-2xl border border-line/70 bg-white/[0.015] p-4">
      <div className="flex items-center gap-2">
        <span className="eyebrow">Cost &amp; latency</span>
        <span className="h-1 w-1 rounded-full bg-fg-faint" />
        <span className="font-mono text-2xs text-fg-faint">
          fast model plans · larger model synthesizes + critiques
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5 rounded-xl border border-line/60 bg-white/[0.02] px-3 py-2.5">
            <s.icon className="h-4 w-4 text-accent-soft" />
            <div>
              <div className="font-display text-base font-semibold text-fg tnum">{s.value}</div>
              <div className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-fg-muted">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
