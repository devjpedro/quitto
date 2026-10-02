import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const PADDING = { none: "", md: "p-4", lg: "p-5" } as const;

export function Card({
  tone = "default",
  padding = "md",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  padding?: keyof typeof PADDING;
  tone?: "default" | "brand";
}) {
  return (
    <div
      className={cn(
        "rounded-card",
        tone === "brand"
          ? "bg-brand-surface text-on-brand"
          : "border border-line bg-surface-raised text-ink",
        PADDING[padding],
        className
      )}
      {...props}
    />
  );
}
