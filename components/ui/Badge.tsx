import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  neutral: "border-white/10 bg-white/[0.04] text-fg-dim",
  accent: "border-accent/30 bg-accent/10 text-accent-soft",
  violet: "border-violet/30 bg-violet/10 text-violet-soft",
  cyan: "border-cyan/25 bg-cyan/10 text-cyan-soft",
  bull: "border-bull/30 bg-bull/10 text-bull",
  bear: "border-bear/30 bg-bear/10 text-bear",
  amber: "border-amber/30 bg-amber/10 text-amber",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  mono = true,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES | string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs uppercase tracking-[0.12em]",
        mono && "font-mono",
        TONES[tone] ?? TONES.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}
