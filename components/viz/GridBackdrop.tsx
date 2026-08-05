import { cn } from "@/lib/utils";

/** A bounded HUD grid panel backdrop (for section decoration). */
export function GridBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 bg-hud-grid-sm opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000,transparent)]",
        className,
      )}
    />
  );
}
