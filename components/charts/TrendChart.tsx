"use client";

import { motion } from "framer-motion";

interface Point {
  date: string;
  ece: number;
  brier: number;
}

/** ECE + Brier over time — the "our eval harness is improving" chart. Lower is better. */
export function TrendChart({ data, height = 200 }: { data: Point[]; height?: number }) {
  const width = 640;
  const pad = { l: 40, r: 16, t: 20, b: 30 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;

  const all = data.flatMap((d) => [d.ece, d.brier]);
  const min = Math.min(...all) * 0.85;
  const max = Math.max(...all) * 1.08;
  const X = (i: number) => pad.l + (i / (data.length - 1)) * iw;
  const Y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * ih;

  const line = (key: "ece" | "brier") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${X(i)} ${Y(d[key])}`).join(" ");
  const area = `${line("ece")} L ${X(data.length - 1)} ${pad.t + ih} L ${X(0)} ${pad.t + ih} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5B8CFF" stopOpacity="0.32" />
          <stop offset="1" stopColor="#5B8CFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trend-line" x1="0" y1="0" x2={width} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9A6BFF" />
          <stop offset="1" stopColor="#5B8CFF" />
        </linearGradient>
      </defs>

      {[0, 0.5, 1].map((t) => {
        const v = min + t * (max - min);
        return (
          <g key={t}>
            <line x1={pad.l} y1={Y(v)} x2={width - pad.r} y2={Y(v)} stroke="rgba(255,255,255,0.05)" />
            <text x={pad.l - 8} y={Y(v) + 3} fill="#6B7890" fontSize="9" textAnchor="end" className="font-mono">
              {v.toFixed(2)}
            </text>
          </g>
        );
      })}

      <motion.path
        d={area}
        fill="url(#trend-fill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.8 }}
      />

      {/* Brier (secondary, faint) */}
      <motion.path
        d={line("brier")}
        fill="none"
        stroke="#6B7890"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        pathLength={1}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: "easeInOut" }}
      />

      {/* ECE (primary) */}
      <motion.path
        d={line("ece")}
        fill="none"
        stroke="url(#trend-line)"
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength={1}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      />

      {data.map((d, i) => (
        <g key={d.date}>
          <motion.circle
            cx={X(i)}
            cy={Y(d.ece)}
            r="3.5"
            fill="#5B8CFF"
            stroke="#05070c"
            strokeWidth="2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.9 + i * 0.08, type: "spring", stiffness: 300, damping: 18 }}
          />
          <text x={X(i)} y={height - 10} fill="#6B7890" fontSize="9" textAnchor="middle" className="font-mono">
            {d.date.slice(5)}
          </text>
        </g>
      ))}
    </svg>
  );
}
