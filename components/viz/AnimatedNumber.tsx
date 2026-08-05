"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";

/**
 * Count-up number. Robust by design: the CORRECT value is the baseline render,
 * so if the count-up can't run (background tab / no JS / reduced-motion / crawler)
 * the real number is shown — never a stuck 0. The animation is pure enhancement.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.2,
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const fmt = (v: number) => `${prefix}${v.toFixed(decimals)}${suffix}`;
  const [display, setDisplay] = useState(() => fmt(value));

  useEffect(() => {
    if (!inView) return;
    const reduce =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(fmt(value));
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(fmt(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, decimals, prefix, suffix, duration]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
