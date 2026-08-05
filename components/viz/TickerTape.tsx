import { UNIVERSE } from "@/lib/config";

/** Decorative marquee of covered tickers with deterministic pseudo-deltas. */
export function TickerTape() {
  const items = Object.entries(UNIVERSE).map(([sym], i) => {
    const delta = ((Math.sin(i * 3.1) * 3.4) as number);
    return { sym, delta };
  });
  const row = [...items, ...items];
  return (
    <div className="relative w-full overflow-hidden border-y border-line/60 bg-white/[0.01] py-2.5 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div className="flex w-max animate-marquee gap-8">
        {row.map((it, i) => (
          <span key={i} className="flex items-center gap-2 font-mono text-xs">
            <span className="text-fg-dim">{it.sym}</span>
            <span className={it.delta >= 0 ? "text-bull" : "text-bear"}>
              {it.delta >= 0 ? "▲" : "▼"} {Math.abs(it.delta).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
