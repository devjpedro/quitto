import { ToggleGroup } from "radix-ui";
import { useRef } from "react";
import { useScrollsSideways } from "@/hooks/use-scrolls-sideways";
import { cn } from "@/lib/utils";
import { CHIP, CHIP_FADE, CHIP_FRAME, CHIP_STRIP } from "./chip-strip";

export interface FilterChipOption<V extends string> {
  count?: number;
  label: string;
  value: V;
}

/**
 * A filter as a toggle group of chips (one chosen; the arrows move, clicking
 * the chosen one keeps it): the chosen chip is the black of action (DIRECAO),
 * the rest are filled. One scrolling line on a phone, wrapping from md. The
 * count joins the accessible name ("Atrasadas 3").
 */
export function FilterChips<V extends string>({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string;
  onValueChange: (value: V) => void;
  options: FilterChipOption<V>[];
  value: V;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const { moreToTheRight } = useScrollsSideways(stripRef, options.length);
  return (
    <div className={CHIP_FRAME}>
      <ToggleGroup.Root
        aria-label={label}
        className={cn(CHIP_STRIP, moreToTheRight && CHIP_FADE)}
        onValueChange={(next) => {
          if (next) {
            onValueChange(next as V);
          }
        }}
        ref={stripRef}
        type="single"
        value={value}
      >
        {options.map((option) => (
          <ToggleGroup.Item
            className={cn(
              CHIP,
              "min-h-11 cursor-pointer bg-surface-card text-ink transition-colors hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:h-8 md:min-h-0",
              "data-[state=on]:bg-ink data-[state=on]:text-ink-inverse"
            )}
            key={option.value}
            value={option.value}
          >
            {option.label}
            {option.count === undefined ? null : (
              <>
                {" "}
                <span className="text-[12.5px] tabular-nums">
                  {option.count}
                </span>
              </>
            )}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}
