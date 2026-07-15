import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-display font-semibold text-xs tracking-tight ring-1 ring-inset transition-colors",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground ring-border",
        brand: "bg-primary/10 text-primary-strong ring-primary/20",
        gold: "bg-gold/12 text-gold-foreground ring-gold/25",
        success: "bg-success/12 text-success-foreground ring-success/25",
        warning:
          "bg-amber-500/15 text-amber-600 ring-amber-500/25 dark:text-amber-400",
        danger: "bg-destructive/12 text-destructive ring-destructive/25",
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
