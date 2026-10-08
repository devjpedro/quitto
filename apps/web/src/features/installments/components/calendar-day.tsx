import type { Locale } from "@quitto/shared";
import { BAR_SEGMENT } from "@/components/ui/installment-bar";
import { Money } from "@/components/ui/money";
import { dayMonthLong } from "@/lib/date-parts";
import { pluralForm } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { type CalendarDay as Day, markOf } from "../lib/calendar-month";
import type { InstallmentListItem } from "../types";

const MARKS_MAX = 3;
const CHIPS_MAX = 2;

/** "8 de outubro, 2 parcelas": the day button's whole name. */
function dayName(day: Day, locale: Locale, today: string): string {
  return dayMonthLong(day.iso, locale, today);
}

function Swatch({
  className,
  item,
  today,
}: {
  className: string;
  item: InstallmentListItem;
  today: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-1 shrink-0 rounded-[2px]",
        className,
        BAR_SEGMENT[markOf(item, today)]
      )}
    />
  );
}

/** The number: today is the black of action. */
function DayNumber({ day }: { day: Day }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full font-medium text-[13px] tabular-nums",
        day.isToday && "bg-ink text-ink-inverse"
      )}
    >
      {Number(day.iso.slice(8, 10))}
    </span>
  );
}

/**
 * One day of the grid (mockup 17, D). Below 1440 px the day is one button
 * (it picks the day; its installments list under the grid) with up to three
 * dashes for what falls on it. From 1440 px each installment is its own chip in
 * the cell, with the contract and the amount, and tapping it opens the panel.
 */
export function CalendarDay({
  day,
  locale,
  onOpen,
  onSelect,
  selected,
  selectedId,
  today,
}: {
  day: Day;
  locale: Locale;
  onOpen: (id: string) => void;
  onSelect: (iso: string) => void;
  selected: boolean;
  selectedId: string | null;
  today: string;
}) {
  const count = day.items.length;
  const date = dayName(day, locale, today);
  let label = m.installments_day_none({ date });
  if (count > 0) {
    label =
      pluralForm(count, locale) === "one"
        ? m.installments_day_one({ date })
        : m.installments_day_other({ date, count });
  }
  const muted = !day.inMonth;
  return (
    <div
      className={cn(
        "relative bg-surface-card",
        selected && "bg-row-selected",
        muted && "text-ink-muted/60"
      )}
      data-testid={`calendar-cell-${day.iso}`}
    >
      {/* Below lateral: the day is the button. */}
      <button
        aria-label={label}
        aria-pressed={selected}
        className="flex lateral:hidden min-h-14 w-full flex-col items-center gap-1 rounded-[inherit] px-0.5 py-1.5 transition-colors hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset disabled:pointer-events-none md:min-h-[72px]"
        data-testid={`calendar-day-${day.iso}`}
        disabled={muted}
        onClick={() => onSelect(day.iso)}
        type="button"
      >
        <DayNumber day={day} />
        <span aria-hidden="true" className="flex flex-col items-center gap-0.5">
          {day.items.slice(0, MARKS_MAX).map((item) => (
            <Swatch
              className="w-5"
              item={item}
              key={item.installmentId}
              today={today}
            />
          ))}
          {count > MARKS_MAX ? (
            <span className="text-[10.5px] text-ink-muted">
              {m.installments_day_more({ count: count - MARKS_MAX })}
            </span>
          ) : null}
        </span>
      </button>
      {/* From lateral: the cell lists its installments. */}
      <div
        className="lateral:flex hidden min-h-24 flex-col gap-1 p-1.5"
        data-testid={`calendar-day-wide-${day.iso}`}
      >
        <DayNumber day={day} />
        {day.items.slice(0, CHIPS_MAX).map((item) => {
          const receive = item.direction === "receive";
          return (
            <button
              aria-current={
                selectedId === item.installmentId ? "true" : undefined
              }
              className={cn(
                "flex min-w-0 flex-col items-start rounded-control bg-surface-inset px-1.5 py-1 text-left text-[11.5px] leading-tight transition-colors hover:bg-surface-inset-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                selectedId === item.installmentId && "ring-2 ring-brand"
              )}
              data-installment-row={item.installmentId}
              data-testid={`installment-row-${item.installmentId}`}
              key={item.installmentId}
              onClick={() => onOpen(item.installmentId)}
              type="button"
            >
              <span className="flex w-full min-w-0 items-center gap-1 text-ink-muted">
                <Swatch className="w-2.5" item={item} today={today} />
                <span className="truncate">{item.contractTitle}</span>
              </span>
              <Money
                cents={item.amountCents}
                className={cn(
                  "font-medium",
                  receive ? "text-brand" : "text-ink"
                )}
                sign={receive ? "+" : "−"}
              />
            </button>
          );
        })}
        {count > CHIPS_MAX ? (
          <span className="px-1 text-[11px] text-ink-muted">
            {m.installments_day_more({ count: count - CHIPS_MAX })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
