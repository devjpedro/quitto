import { Switch as RadixSwitch } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * An on/off setting (Radix Switch): a 44 × 26 track in a 44 px target. On is
 * `brand`; off is `field-line` (3:1 against the card, WCAG 1.4.11; the
 * `track` token is 1.3:1). The thumb slides, or just swaps with reduced
 * motion. Its name and description come from the row it sits in.
 */
export function Switch({
  className,
  ...props
}: ComponentProps<typeof RadixSwitch.Root>) {
  return (
    <RadixSwitch.Root
      className={cn(
        "group flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-control focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span className="relative h-[26px] w-11 rounded-full bg-field-line transition-colors group-focus-visible:ring-2 group-focus-visible:ring-brand group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-surface-card group-data-[state=checked]:bg-brand">
        <RadixSwitch.Thumb className="absolute top-0.5 left-0.5 block size-[22px] rounded-full bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-transform duration-150 data-[state=checked]:translate-x-[18px] motion-reduce:transition-none" />
      </span>
    </RadixSwitch.Root>
  );
}
