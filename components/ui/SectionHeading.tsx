import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

export function SectionHeading({
  eyebrow,
  title,
  description,
  center = true,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <Reveal className={cn(center && "mx-auto text-center", "max-w-2xl", className)}>
      <span className="chip mb-4 border-accent/20 text-accent-soft">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        {eyebrow}
      </span>
      <h2 className="font-display text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{title}</h2>
      {description && (
        <p className={cn("mt-4 text-base leading-relaxed text-fg-muted", center && "mx-auto")}>{description}</p>
      )}
    </Reveal>
  );
}
