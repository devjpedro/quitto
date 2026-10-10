import { CaretDown, Check } from "@phosphor-icons/react";
import { Select as SelectPrimitive } from "radix-ui";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectGroup {
  /** The group's heading ("2026"); omit for a flat list. */
  label?: string;
  options: readonly SelectOption[];
}

/**
 * The app's own select (Radix, in the Tátil look): a quiet trigger with a
 * caret, and a floating list with the chosen option ticked. Keyboard and
 * type-ahead come from Radix; the list opens beside the trigger on a phone
 * too, with 44 px rows.
 */
export function Select({
  className,
  display,
  groups,
  label,
  onValueChange,
  value,
}: {
  className?: string;
  /** What the trigger shows; by default the chosen option's label. */
  display?: ReactNode;
  groups: readonly SelectGroup[];
  /** The accessible name: the trigger has no visible label of its own. */
  label: string;
  onValueChange: (value: string) => void;
  value: string;
}) {
  const chosen = groups
    .flatMap((group) => group.options)
    .find((option) => option.value === value);
  return (
    <SelectPrimitive.Root onValueChange={onValueChange} value={value}>
      <SelectPrimitive.Trigger
        aria-label={label}
        className={cn(
          "inline-flex h-11 items-center gap-1.5 rounded-control pr-2.5 pl-3 font-display font-semibold text-base text-ink tracking-[-0.01em] transition-colors hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand data-[state=open]:bg-surface-card md:h-8 md:text-[15px]",
          className
        )}
      >
        <SelectPrimitive.Value>
          {display ?? chosen?.label}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <CaretDown
            aria-hidden="true"
            className="text-ink-muted"
            size={14}
            weight="bold"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="z-[70] max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-card bg-surface p-1.5 text-ink shadow-float ring-1 ring-ink/[.06]"
          collisionPadding={12}
          position="popper"
          sideOffset={8}
        >
          <SelectPrimitive.Viewport className="max-h-[inherit]">
            {groups.map((group, index) => (
              <Fragment key={group.label ?? index}>
                {index > 0 ? (
                  <SelectPrimitive.Separator className="mx-1 my-1.5 h-px bg-divider" />
                ) : null}
                <SelectPrimitive.Group>
                  {group.label ? (
                    <SelectPrimitive.Label className="px-2.5 pt-1.5 pb-1 text-ink-muted text-xs tabular-nums">
                      {group.label}
                    </SelectPrimitive.Label>
                  ) : null}
                  {group.options.map((option) => (
                    <SelectPrimitive.Item
                      className="flex h-11 cursor-default select-none items-center justify-between gap-6 rounded-control px-2.5 text-sm outline-none data-[highlighted]:bg-surface-card data-[state=checked]:font-semibold md:h-10"
                      key={option.value}
                      value={option.value}
                    >
                      <SelectPrimitive.ItemText>
                        {option.label}
                      </SelectPrimitive.ItemText>
                      <SelectPrimitive.ItemIndicator>
                        <Check aria-hidden="true" size={16} weight="bold" />
                      </SelectPrimitive.ItemIndicator>
                    </SelectPrimitive.Item>
                  ))}
                </SelectPrimitive.Group>
              </Fragment>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
