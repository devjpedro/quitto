import type { Icon } from "@phosphor-icons/react";
import { ArrowElbowDownLeft, WarningCircle } from "@phosphor-icons/react";
import { Command } from "cmdk";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { m } from "@/paraglide/messages.js";

/** The group's title: 12/500 in ink-muted, as a heading of its own list. */
export function PaletteGroup({
  children,
  ...props
}: ComponentProps<typeof Command.Group>) {
  return (
    <Command.Group
      className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-muted [&_[cmdk-group-heading]]:text-xs"
      {...props}
    >
      {children}
    </Command.Group>
  );
}

/**
 * A row: at least 44 px (48 on a phone), the selected one filled by
 * `surface-card` across its width (never a side bar), with the "↵" hint at
 * its end. Its anchor is an icon, a ring or a face.
 */
export function PaletteItem({
  anchor,
  children,
  end,
  ...props
}: ComponentProps<typeof Command.Item> & {
  anchor: ReactNode;
  end?: ReactNode;
}) {
  return (
    <Command.Item
      className="group flex min-h-12 cursor-pointer select-none items-center gap-3 rounded-control px-3 text-sm outline-none transition-colors data-[selected=true]:bg-surface-card md:min-h-11"
      {...props}
    >
      <span className="flex size-[18px] shrink-0 items-center justify-center text-ink-muted group-data-[selected=true]:text-ink">
        {anchor}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2.5 font-medium">
        {children}
      </span>
      {end ? (
        <span className="shrink-0 text-ink-muted text-xs tabular-nums">
          {end}
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className="hidden size-[22px] shrink-0 items-center justify-center rounded-[6px] bg-surface-inset text-ink-muted group-data-[selected=true]:flex md:group-data-[selected=true]:flex"
      >
        <ArrowElbowDownLeft size={12} />
      </span>
    </Command.Item>
  );
}

/** An icon anchor: outline at rest, filled when the row is selected. */
export function PaletteIcon({ icon: Glyph }: { icon: Icon }) {
  return (
    <>
      <Glyph
        aria-hidden="true"
        className="group-data-[selected=true]:hidden"
        size={18}
      />
      <Glyph
        aria-hidden="true"
        className="hidden group-data-[selected=true]:block"
        size={18}
        weight="fill"
      />
    </>
  );
}

/** "2 atrasadas": the overdue count with its icon and its word, never only a color. */
export function OverdueTag({ label }: { label: string }) {
  return (
    <Tag className="shrink-0" tone="danger">
      <WarningCircle aria-hidden="true" size={12} weight="bold" />
      {label}
    </Tag>
  );
}

/** The contract list failed: says so in place, while every fixed command keeps working. */
export function ContractsLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3" role="alert">
      <p className="text-ink text-sm">{m.palette_contracts_error()}</p>
      <Button
        onClick={onRetry}
        // cmdk handles Enter at its root for any target: it cancels the
        // button's own activation and runs the highlighted command instead.
        // Stopping it here lets Enter press this button, as it does anywhere.
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.stopPropagation();
          }
        }}
        size="sm"
        variant="inset"
      >
        {m.section_retry()}
      </Button>
    </div>
  );
}
