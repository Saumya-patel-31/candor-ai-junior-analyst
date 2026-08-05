"use client";

import { motion } from "framer-motion";

export function Sparkline({
  data,
  width = 88,
  height = 28,
  color = "#5B8CFF",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / span) * height}`)
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <motion.polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        initial={{ pathLength: 0, opacity: 0.4 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </svg>
  );
}
