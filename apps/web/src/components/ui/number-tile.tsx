import { cn } from "@/lib/utils";
import type { BarStatus } from "./installment-bar";

const TONE: Record<BarStatus, string> = {
  paid: "bg-brand-subtle text-brand",
  overdue: "bg-danger-subtle text-danger",
  review: "bg-warning-subtle text-warning",
  today: "bg-ink text-ink-inverse",
  open: "bg-surface-inset text-ink-muted",
};

/**
 * The anchor of an installment row (mockup 14): its number in Geist Mono on a
 * 44 px tile tinted by the state, so the column of tiles is the bar unrolled.
 * On the selected row (row-selected is the paid green) the paid and open
 * tiles step to inset. Decorative: the row says the state in text.
 */
export function NumberTile({
  label,
  range = false,
  selected = false,
  tone,
}: {
  label: string;
  range?: boolean;
  selected?: boolean;
  tone: BarStatus;
}) {
  const inset = selected && (tone === "paid" || tone === "open");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-control font-medium font-mono tabular-nums",
        range
          ? "text-[11.5px] tracking-[-0.04em]"
          : "text-[15px] tracking-[-0.02em]",
        TONE[tone],
        inset && "bg-surface-inset"
      )}
    >
      {label}
    </span>
  );
}
