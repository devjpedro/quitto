import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-display font-semibold text-xs tracking-tight ring-1 ring-inset transition-colors",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground ring-border",
        brand: "bg-primary/10 text-primary ring-primary/20",
        success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
        warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
        danger: "bg-red-50 text-red-700 ring-red-600/20",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      className={cn(badgeVariants({ tone }), className)}
      data-slot="badge"
      {...props}
    />
  );
}

export { badgeVariants };
