import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE: Record<
  "neutral" | "brand" | "highlight" | "warning" | "danger",
  string
> = {
  neutral: "bg-surface-sunken text-ink-muted",
  brand: "bg-brand-subtle text-brand",
  highlight: "bg-highlight text-on-highlight",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
};

export function Tag({
  tone = "neutral",
  className,
  children,
}: {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof TONE;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 font-medium text-[11px] leading-4",
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
