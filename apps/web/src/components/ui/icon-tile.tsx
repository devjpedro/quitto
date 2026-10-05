import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/** Above this, the corner shows "99+": three characters still fit the tile. */
const MAX_COUNT = 99;

export type IconTileTone = "brand" | "warning" | "danger" | "neutral";

const TONE: Record<IconTileTone, string> = {
  brand: "bg-brand-subtle text-brand",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  neutral: "bg-surface-inset text-ink-muted",
};

/**
 * The anchor of a notification row: its icon on a tile tinted by the kind.
 * A grouped line (DIRECAO › "Agrupe o que se repete") shows its count in the
 * corner, ringed in the list's color; inside a line marked `group/row`, the
 * ring follows its hover fill, so no halo of the resting fill is left.
 * Decorative: the row's title says it (a group's title says the count).
 */
export function IconTile({
  count,
  icon: IconComponent,
  tone,
}: {
  count?: number;
  icon: Icon;
  tone: IconTileTone;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center rounded-control",
        TONE[tone]
      )}
    >
      <IconComponent size={19} />
      {count !== undefined && count > 1 ? (
        <span className="absolute -top-[5px] -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-[5px] font-semibold text-[11px] text-ink-inverse tabular-nums ring-2 ring-surface-card group-hover/row:ring-surface-card-hover">
          {count > MAX_COUNT
            ? m.notifications_count_overflow({ max: MAX_COUNT })
            : count}
        </span>
      ) : null}
    </span>
  );
}
