import Link from "next/link";
import { Wordmark } from "@/components/ui/Logo";
import { DISCLAIMER } from "@/lib/config";

export function Footer() {
  return (
    <footer className="relative z-10 mt-32 border-t border-line/70">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-fg-muted">
              An autonomous research analyst that plans, retrieves, cites, and self-critiques —
              then publishes a public record of its own calibration.
            </p>
          </div>
          <div>
            <h4 className="eyebrow mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm">
              {[
                { href: "/#terminal", label: "Live terminal" },
                { href: "/track-record", label: "Calibration record" },
                { href: "/dashboard", label: "Cost dashboard" },
                { href: "/methodology", label: "Methodology" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-fg-dim hover:text-fg cursor-pointer transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="eyebrow mb-4">Sources</h4>
            <ul className="space-y-2.5 text-sm text-fg-dim">
              <li>SEC EDGAR · XBRL company facts</li>
              <li>10-K / 10-Q filings (RAG)</li>
              <li>Finnhub news · market data</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-line/70 bg-white/[0.015] p-4">
          <p className="font-mono text-2xs leading-relaxed text-fg-muted">
            <span className="text-amber">DISCLAIMER — </span>
            {DISCLAIMER}
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 text-xs text-fg-faint sm:flex-row">
          <span>© {new Date().getFullYear()} Candor · a research/education project.</span>
          <span className="font-mono">planner→tools→synthesis→self-critique→calibration</span>
        </div>
      </div>
    </footer>
  );
}
