import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE: Record<
  "neutral" | "brand" | "highlight" | "warning" | "danger" | "ink",
  string
> = {
  // Neutral only sits inside a card (DIRECAO › Forma): one step lighter.
  neutral: "bg-surface-inset text-ink-muted",
  brand: "bg-brand-subtle text-brand",
  highlight: "bg-highlight text-on-highlight",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  // "Vence hoje" (mockup 13): the black of action on the day it is due.
  ink: "bg-ink text-ink-inverse",
};

export type TagTone = keyof typeof TONE;

export function Tag({
  tone = "neutral",
  className,
  children,
}: {
  children: ReactNode;
  className?: string;
  tone?: TagTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 self-start whitespace-nowrap rounded-full px-2 py-px font-medium text-[11.5px] leading-[18px]",
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
