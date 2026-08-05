"use client";

import { motion } from "framer-motion";
import type { ReliabilityBin } from "@/lib/types";

/**
 * Reliability diagram (calibration curve). X = stated confidence, Y = observed
 * hit-rate. The diagonal is perfect calibration; points below it = overconfidence.
 * This is the single most important artifact in the whole product.
 */
export function ReliabilityDiagram({
  bins,
  size = 360,
}: {
  bins: ReliabilityBin[];
  size?: number;
}) {
  const pad = 44;
  const plot = size - pad * 2;
  const X = (v: number) => pad + v * plot;
  const Y = (v: number) => pad + (1 - v) * plot;

  const sorted = [...bins].sort((a, b) => a.predicted - b.predicted);
  const curve = sorted.map((b) => `${X(b.predicted)},${Y(b.observed)}`).join(" ");
  const areaPts =
    sorted.map((b) => `${X(b.predicted)},${Y(b.observed)}`).join(" ") +
    " " +
    [...sorted].reverse().map((b) => `${X(b.predicted)},${Y(b.predicted)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[420px]">
      <defs>
        <linearGradient id="rel-line" x1="0" y1="0" x2={size} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5B8CFF" />
          <stop offset="1" stopColor="#3DE0E6" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={X(t)} y1={Y(0)} x2={X(t)} y2={Y(1)} stroke="rgba(255,255,255,0.05)" />
          <line x1={X(0)} y1={Y(t)} x2={X(1)} y2={Y(t)} stroke="rgba(255,255,255,0.05)" />
          <text x={X(t)} y={Y(0) + 18} fill="#6B7890" fontSize="9" textAnchor="middle" className="font-mono">
            {t * 100}
          </text>
          <text x={X(0) - 10} y={Y(t) + 3} fill="#6B7890" fontSize="9" textAnchor="end" className="font-mono">
            {t * 100}
          </text>
        </g>
      ))}

      {/* Perfect-calibration diagonal */}
      <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" strokeDasharray="5 5" />

      {/* Miscalibration area */}
      <motion.polygon
        points={areaPts}
        fill="rgba(251,191,36,0.10)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.8 }}
      />

      {/* Model curve */}
      <motion.polyline
        points={curve}
        fill="none"
        stroke="url(#rel-line)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Bin points */}
      {sorted.map((b, i) => {
        const over = b.observed < b.predicted;
        return (
          <motion.circle
            key={b.bucket}
            cx={X(b.predicted)}
            cy={Y(b.observed)}
            r={4 + Math.sqrt(b.count) * 1.5}
            fill={over ? "#FBBF24" : "#34D399"}
            stroke="#05070c"
            strokeWidth="2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.9 + i * 0.08, type: "spring", stiffness: 260, damping: 18 }}
          />
        );
      })}

      {/* Axis labels */}
      <text x={size / 2} y={size - 6} fill="#A7B2C8" fontSize="11" textAnchor="middle" className="font-mono">
        stated confidence
      </text>
      <text
        x={12}
        y={size / 2}
        fill="#A7B2C8"
        fontSize="11"
        textAnchor="middle"
        transform={`rotate(-90 12 ${size / 2})`}
        className="font-mono"
      >
        observed hit-rate
      </text>
    </svg>
  );
}
