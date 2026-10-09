import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactNode } from "react";

/**
 * A short label for an icon-only control, on hover and on keyboard focus
 * (Radix: it also names the control for a screen reader through
 * `aria-describedby`, so give the control its own `aria-label` too). Dark
 * with inverted text, the control's radius, the float shadow.
 */
export function Tooltip({
  children,
  label,
  side = "bottom",
}: {
  children: ReactNode;
  label: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className="z-50 rounded-control bg-ink px-2.5 py-1.5 text-ink-inverse text-xs shadow-float"
            side={side}
            sideOffset={6}
          >
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
