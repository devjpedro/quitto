import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium text-sm transition-[background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[.97] disabled:pointer-events-none disabled:opacity-50 motion-reduce:active:scale-100 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-ink text-ink-inverse hover:bg-ink/90",
        secondary:
          "border border-line bg-surface text-ink hover:bg-surface-sunken",
        // Inside a card (DIRECAO › Forma): one step lighter than the card, no border.
        inset: "bg-surface-inset text-ink hover:bg-surface-inset-hover",
        ghost: "text-ink hover:bg-surface-sunken",
        // Dark: light button with dark text on the green card, as in mockup 08.
        // The dark:hover keeps the hover from falling back to the graphite one.
        onBrand:
          "bg-surface text-ink hover:bg-surface/90 focus-visible:ring-highlight focus-visible:ring-offset-brand-surface dark:bg-ink dark:text-ink-inverse dark:hover:bg-ink/90",
        onBrandOutline:
          "border border-on-brand/40 text-on-brand hover:bg-on-brand/10 focus-visible:ring-highlight focus-visible:ring-offset-brand-surface",
        danger: "bg-danger text-ink-inverse hover:bg-danger/90",
      },
      size: {
        sm: "h-11 px-3 md:h-9",
        md: "h-11 px-4 md:h-10",
        lg: "h-12 px-5 text-base",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  }
);

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  type = "button",
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, block }), className)}
      type={asChild ? undefined : type}
      {...props}
    />
  );
}
