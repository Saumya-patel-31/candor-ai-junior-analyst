"use client";

import { motion } from "framer-motion";
import { confidenceLabel } from "@/lib/utils";
import { AnimatedNumber } from "@/components/viz/AnimatedNumber";

/**
 * Confidence gauge — a semicircular arc filled along a red→amber→green spectrum.
 * The fill length encodes the 0–100 confidence score.
 */
export function Gauge({
  value,
  size = 240,
  label = true,
  sublabel,
}: {
  value: number;
  size?: number;
  label?: boolean;
  sublabel?: string;
}) {
  const w = size;
  const h = size * 0.62;
  const cx = w / 2;
  const cy = w / 2;
  const r = w / 2 - 18;
  const track = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const pct = Math.max(0, Math.min(100, value)) / 100;

  return (
    <div className="relative flex flex-col items-center" style={{ width: w }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${cy + 6}`} className="overflow-visible">
        <defs>
          <linearGradient id="gauge-spectrum" x1="0" y1="0" x2={w} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FB6A7E" />
            <stop offset="0.5" stopColor="#FBBF24" />
            <stop offset="1" stopColor="#34D399" />
          </linearGradient>
          <filter id="gauge-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track */}
        <path d={track} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round" />
        {/* Tick marks */}
        {Array.from({ length: 11 }).map((_, i) => {
          const a = Math.PI - (i / 10) * Math.PI;
          const x1 = cx + Math.cos(a) * (r + 9);
          const y1 = cy - Math.sin(a) * (r + 9);
          const x2 = cx + Math.cos(a) * (r + 14);
          const y2 = cy - Math.sin(a) * (r + 14);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />;
        })}
        {/* Progress */}
        <motion.path
          d={track}
          fill="none"
          stroke="url(#gauge-spectrum)"
          strokeWidth="12"
          strokeLinecap="round"
          pathLength={1}
          filter="url(#gauge-glow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: pct }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* End dot */}
        <motion.circle
          r="7"
          fill="#fff"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          style={{
            offsetPath: `path("${track}")`,
            offsetDistance: `${pct * 100}%`,
          }}
        />
      </svg>

      <div className="-mt-[38%] flex flex-col items-center">
        <div className="flex items-baseline font-display text-5xl font-semibold tracking-tight text-fg tnum">
          <AnimatedNumber value={value} />
          <span className="ml-0.5 text-lg text-fg-muted">/100</span>
        </div>
        {label && (
          <span className="mt-1 font-mono text-2xs uppercase tracking-[0.2em] text-fg-dim">
            {sublabel ?? confidenceLabel(value)}
          </span>
        )}
      </div>
    </div>
  );
}
