import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function TooltipProvider({
  delayDuration = 200,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

export function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

export function TooltipTrigger(
  props: ComponentProps<typeof TooltipPrimitive.Trigger>
) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

export function TooltipContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        className={cn(
          "data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 origin-[var(--radix-tooltip-content-transform-origin)] rounded-md bg-foreground px-2 py-1 text-background text-xs shadow-[var(--shadow-md)] duration-[var(--dur-fast)] ease-[var(--ease-out)] data-[state=closed]:animate-out data-[state=open]:animate-in",
          className
        )}
        collisionPadding={collisionPadding}
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
