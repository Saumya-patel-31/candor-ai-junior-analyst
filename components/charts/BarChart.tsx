"use client";

import { motion } from "framer-motion";

export interface Bar {
  label: string;
  value: number;
  hint?: string;
}

export function BarChart({
  data,
  height = 200,
  color = "#5B8CFF",
  showValues = false,
  everyNthLabel = 1,
  valueSuffix = "",
}: {
  data: Bar[];
  height?: number;
  color?: string;
  showValues?: boolean;
  everyNthLabel?: number;
  valueSuffix?: string;
}) {
  const width = 640;
  const pad = { l: 8, r: 8, t: 16, b: 26 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const max = Math.max(...data.map((d) => d.value), 0.0001);
  const slot = iw / data.length;
  const bw = Math.min(slot * 0.64, 46);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id={`bar-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor={color} stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {data.map((d, i) => {
        const h = (d.value / max) * ih;
        const x = pad.l + i * slot + (slot - bw) / 2;
        const y = pad.t + ih - h;
        return (
          <g key={`${d.label}-${i}`}>
            <motion.rect
              x={x}
              width={bw}
              rx={Math.min(bw / 2.6, 5)}
              fill={`url(#bar-${color})`}
              initial={{ height: 0, y: pad.t + ih }}
              whileInView={{ height: Math.max(h, 1), y }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: i * 0.02, ease: [0.22, 1, 0.36, 1] }}
            />
            {showValues && (
              <text x={x + bw / 2} y={y - 5} fill="#A7B2C8" fontSize="9" textAnchor="middle" className="font-mono">
                {d.value % 1 === 0 ? d.value : d.value.toFixed(2)}
                {valueSuffix}
              </text>
            )}
            {i % everyNthLabel === 0 && (
              <text x={x + bw / 2} y={height - 8} fill="#6B7890" fontSize="8.5" textAnchor="middle" className="font-mono">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
