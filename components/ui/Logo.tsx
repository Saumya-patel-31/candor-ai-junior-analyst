import { cn } from "@/lib/utils";

/** Candor mark — a calibrated aperture: concentric arcs closing on a true center. */
export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="candor-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5B8CFF" />
          <stop offset="0.55" stopColor="#9A6BFF" />
          <stop offset="1" stopColor="#3DE0E6" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14.5" stroke="url(#candor-g)" strokeOpacity="0.35" strokeWidth="1.2" />
      <path d="M16 3.5a12.5 12.5 0 0 1 0 25" stroke="url(#candor-g)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 8a8 8 0 0 0 0 16" stroke="url(#candor-g)" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="3.1" fill="url(#candor-g)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Logo />
      <span className="font-display text-[1.05rem] font-semibold tracking-tight text-fg">
        Candor
      </span>
    </span>
  );
}
