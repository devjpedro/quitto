import { formatBRLParts } from "@/lib/format";
import { cn } from "@/lib/utils";

const SIZE: Record<"sm" | "md" | "hero", string> = {
  sm: "text-sm font-semibold",
  md: "text-base font-semibold",
  hero: "font-bold text-[clamp(2.4rem,6vw,3.35rem)] leading-[0.98] tracking-[-0.036em]",
};

export function Money({
  cents,
  size = "md",
  className,
}: {
  cents: number;
  size?: "sm" | "md" | "hero";
  className?: string;
}) {
  const { currency, integer, decimal } = formatBRLParts(cents);
  const affix =
    size === "hero"
      ? "text-[0.56em] font-semibold"
      : "text-[0.8em] font-medium";
  return (
    <span
      className={cn("tabular-nums tracking-[-0.02em]", SIZE[size], className)}
    >
      <span className={cn(affix, "text-muted-foreground")}>{currency}</span>
      {size === "hero" ? " " : ""}
      {integer}
      <span className={cn(affix, "text-subtle-foreground")}>{decimal}</span>
    </span>
  );
}
