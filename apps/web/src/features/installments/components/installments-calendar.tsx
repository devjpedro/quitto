import { CaretRight, WarningCircle } from "@phosphor-icons/react";
import type { Locale } from "@quitto/shared";
import { useMemo } from "react";
import { m } from "@/paraglide/messages.js";
import { calendarMonth } from "../lib/calendar-month";
import { addDays, monthTitle } from "../lib/month-range";
import type { InstallmentListItem } from "../types";
import { CalendarDay } from "./calendar-day";
import { DayList } from "./day-list";

const SUNDAY = "2026-10-04";

function weekdays(locale: Locale, style: "narrow" | "short"): string[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: style,
    timeZone: "UTC",
  });
  return Array.from({ length: 7 }, (_, index) =>
    formatter
      .format(new Date(`${addDays(SUNDAY, index)}T00:00:00Z`))
      .replace(".", "")
  );
}

/** The overdue of earlier months are not on the grid: this says so, and takes you to them. */
function CarriedBanner({ count, onSee }: { count: number; onSee: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-card bg-danger-subtle px-4 py-3 text-danger text-sm"
      data-testid="installments-carried"
    >
      <span className="flex min-w-0 items-center gap-2">
        <WarningCircle aria-hidden="true" className="shrink-0" size={16} />
        <span className="font-medium">
          {count === 1
            ? m.installments_carried_one()
            : m.installments_carried_other({ count })}
        </span>
      </span>
      <button
        className="inline-flex shrink-0 items-center gap-1 rounded-control px-1 font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand max-md:min-h-11"
        onClick={onSee}
        type="button"
      >
        {m.installments_carried_action()}
        <CaretRight aria-hidden="true" size={13} />
      </button>
    </div>
  );
}

/**
 * The month as a grid (mockup 17, D): a filled block with 2 px gaps, a day per
 * cell. Below 1440 px the picked day's installments list under it; from
 * 1440 px each installment sits in its day and opens the panel.
 */
export function InstallmentsCalendar({
  carried,
  day,
  items,
  locale,
  month,
  onDay,
  onIntent,
  onOpen,
  onSeeCarried,
  selectedId,
  today,
}: {
  carried: number;
  day: string;
  items: InstallmentListItem[];
  locale: Locale;
  month: string;
  onDay: (iso: string) => void;
  onIntent: (item: InstallmentListItem) => void;
  onOpen: (id: string) => void;
  onSeeCarried: () => void;
  selectedId: string | null;
  today: string;
}) {
  const weeks = useMemo(
    () => calendarMonth(month, items, today),
    [month, items, today]
  );
  const narrow = weekdays(locale, "narrow");
  const short = weekdays(locale, "short");
  const dayItems = weeks.flat().find((d) => d.iso === day)?.items ?? [];
  return (
    <section
      aria-label={m.installments_calendar_label({
        month: monthTitle(month, locale),
      })}
      className="flex flex-col gap-3"
      data-testid="installments-calendar"
    >
      {carried > 0 ? (
        <CarriedBanner count={carried} onSee={onSeeCarried} />
      ) : null}
      <div>
        <div
          aria-hidden="true"
          className="mb-1 grid grid-cols-7 text-center text-[12px] text-ink-muted"
        >
          {short.map((name, index) => (
            <span key={name + String(index)}>
              <span className="md:hidden">{narrow[index]}</span>
              <span className="max-md:hidden">{name}</span>
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 overflow-hidden rounded-card bg-surface">
          {weeks.flat().map((cell) => (
            <CalendarDay
              day={cell}
              key={cell.iso}
              locale={locale}
              onOpen={onOpen}
              onSelect={onDay}
              selected={cell.iso === day && cell.inMonth}
              selectedId={selectedId}
              today={today}
            />
          ))}
        </div>
      </div>
      <div className="lateral:hidden" data-testid="installments-day">
        <DayList
          day={day}
          items={dayItems}
          locale={locale}
          onIntent={onIntent}
          onOpen={onOpen}
          selectedId={selectedId}
          today={today}
        />
      </div>
    </section>
  );
}
