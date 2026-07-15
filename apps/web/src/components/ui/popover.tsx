import { Popover as PopoverPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 4,
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        className={cn(
          "data-[state=closed]:fade-out data-[state=open]:fade-in material-overlay z-50 rounded-md border border-border-strong p-3 text-foreground shadow-[var(--shadow-lg)] outline-none duration-[var(--dur-base)] ease-[var(--ease-out)] data-[state=closed]:animate-out data-[state=open]:animate-in",
          className
        )}
        collisionPadding={collisionPadding}
        sideOffset={sideOffset}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
