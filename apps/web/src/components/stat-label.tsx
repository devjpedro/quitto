import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-medium text-muted-foreground text-xs uppercase tracking-wide",
        className
      )}
    >
      {children}
    </p>
  );
}
