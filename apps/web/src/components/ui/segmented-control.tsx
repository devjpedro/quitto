import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils";

export interface SegmentedOption<V extends string> {
  count?: number;
  label: string;
  value: V;
}

export function SegmentedControl<V extends string>({
  label,
  options,
  value,
  onValueChange,
  block = false,
}: {
  /** `true`: full width always; `"mobile"`: full width below md only (the items share it). */
  block?: boolean | "mobile";
  label: string;
  onValueChange: (value: V) => void;
  options: SegmentedOption<V>[];
  value: V;
}) {
  return (
    <ToggleGroup.Root
      aria-label={label}
      className={cn(
        "gap-0.5 rounded-[12px] bg-surface-sunken p-[3px]",
        block === true && "flex w-full",
        block === "mobile" && "inline-flex max-md:flex max-md:w-full",
        !block && "inline-flex"
      )}
      onValueChange={(next) => {
        // Radix emits "" when the pressed item is clicked again; keep a selection.
        if (next) {
          onValueChange(next as V);
        }
      }}
      type="single"
      value={value}
    >
      {/* The plain space before each count keeps the accessible name "Ativos 5", not "Ativos5". */}
      {options.map((option) => (
        <ToggleGroup.Item
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-1 rounded-[9px] px-3 text-ink-muted text-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand data-[state=on]:bg-surface data-[state=on]:font-medium data-[state=on]:text-ink data-[state=on]:shadow-[0_1px_2px_rgb(0_0_0/0.1)] md:min-h-8",
            block === true && "flex-1",
            block === "mobile" && "max-md:flex-1"
          )}
          key={option.value}
          value={option.value}
        >
          {option.label}
          {option.count === undefined ? null : (
            <>
              {" "}
              <span className="text-ink-muted text-xs tabular-nums">
                {option.count}
              </span>
            </>
          )}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
