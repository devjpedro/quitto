import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const PAGE_WIDTH = {
  default: "max-w-5xl",
  form: "max-w-2xl",
  narrow: "max-w-md",
} as const;

type PageWidth = keyof typeof PAGE_WIDTH;

export function PageContainer({
  children,
  width = "default",
  className,
}: {
  children: ReactNode;
  width?: PageWidth;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6",
        PAGE_WIDTH[width],
        className
      )}
    >
      {children}
    </div>
  );
}
