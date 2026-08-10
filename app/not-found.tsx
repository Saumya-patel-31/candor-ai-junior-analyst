import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { UNIVERSE } from "@/lib/config";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <span className="chip mb-6 border-white/10 text-fg-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-amber" />
        404 · no such memo
      </span>

      <h1 className="font-display text-5xl font-semibold tracking-tight text-fg sm:text-6xl">
        Not <span className="text-gradient-accent">in coverage.</span>
      </h1>

      <p className="mt-5 max-w-md text-base leading-relaxed text-fg-muted">
        That page or memo doesn&apos;t exist. Candor only analyzes companies whose filings
        it has actually ingested — it refuses tickers it can&apos;t ground in a real 10-K
        rather than guessing.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {Object.keys(UNIVERSE).slice(0, 8).map((t) => (
          <Link key={t} href={`/#terminal`} className="chip hover:border-accent/40 hover:text-accent-soft cursor-pointer transition-colors">
            {t}
          </Link>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn-primary px-6 py-3 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to the terminal
        </Link>
        <Link href="/track-record" className="btn-ghost px-6 py-3 text-sm">
          <Sparkles className="h-4 w-4" /> See the track record
        </Link>
      </div>
    </div>
  );
}
