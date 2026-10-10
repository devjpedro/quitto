import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { Locale } from "@quitto/shared";
import { todayISO } from "@quitto/shared";
import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { enUS, ptBR } from "react-day-picker/locale";
import { dayMonthLong, weekdayLong } from "@/lib/date-parts";
import { dateToISO, parseISOToLocalDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { Button } from "./button";
import { IconButton } from "./icon-button";
import { MonthSelect } from "./month-select";

const FILLED = "bg-surface-card hover:bg-surface-card-hover";

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * The month grid of the date field (react-day-picker, in the Tátil look): a
 * header with the month as a Select and the two arrows, the days (44 px on a
 * phone), and a footer with the chosen day and "Hoje". Arrows walk the days,
 * Page Up and Page Down the months, Enter chooses. It holds no popover or
 * sheet: the field puts it in one.
 */
export function Calendar({
  locale,
  min,
  onSelect,
  value,
}: {
  locale: Locale;
  /** The earliest day that can be chosen (ISO). */
  min?: string;
  onSelect: (iso: string) => void;
  /** The chosen day (ISO) or "". */
  value: string;
}) {
  const today = todayISO();
  const selected = parseISOToLocalDate(value);
  const [month, setMonth] = useState(monthOf(selected ? value : today));
  const shown = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)) - 1,
    1
  );
  const go = (delta: number) => {
    const next = new Date(shown.getFullYear(), shown.getMonth() + delta, 1);
    setMonth(monthOf(dateToISO(next)));
  };
  const minDate = min ? parseISOToLocalDate(min) : undefined;
  return (
    <div className="w-full md:w-[304px]">
      <div className="flex items-center gap-1 pb-1.5">
        <MonthSelect
          className="mr-auto"
          label={m.date_calendar_month()}
          locale={locale}
          month={month}
          onMonthChange={setMonth}
        />
        <IconButton
          className={FILLED}
          icon={CaretLeft}
          label={m.date_calendar_prev()}
          onClick={() => go(-1)}
        />
        <IconButton
          className={FILLED}
          icon={CaretRight}
          label={m.date_calendar_next()}
          onClick={() => go(1)}
        />
      </div>
      <DayPicker
        autoFocus
        classNames={{
          root: "w-full",
          month_caption: "sr-only",
          month_grid: "w-full border-collapse",
          weekday: "h-7 text-center font-normal text-ink-muted text-xs",
          day: "p-px text-center",
          day_button: cn(
            "h-11 w-full rounded-control text-ink text-sm tabular-nums transition-colors hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:h-9"
          ),
          today:
            "font-semibold [&>button]:inset-ring-[1.5px] [&>button]:inset-ring-ink",
          selected:
            "[&>button]:bg-ink [&>button]:font-semibold [&>button]:text-ink-inverse [&>button]:hover:bg-ink",
          disabled: "[&>button]:text-ink-muted [&>button]:opacity-55",
        }}
        disabled={minDate ? { before: minDate } : undefined}
        hideNavigation
        locale={locale === "en-US" ? enUS : ptBR}
        mode="single"
        month={shown}
        onMonthChange={(next) => setMonth(monthOf(dateToISO(next)))}
        onSelect={(date) => {
          if (date) {
            onSelect(dateToISO(date));
          }
        }}
        selected={selected}
        weekStartsOn={0}
      />
      <div className="mt-2 flex items-center justify-between gap-2 border-divider border-t pt-2 text-[12.5px] text-ink-muted">
        <span>
          {selected
            ? `${weekdayLong(value, locale)}, ${dayMonthLong(value, locale, today)}`
            : m.date_calendar_none()}
        </span>
        <Button
          disabled={Boolean(min && today < min)}
          onClick={() => onSelect(today)}
          size="sm"
          variant="ghost"
        >
          {m.date_calendar_today()}
        </Button>
      </div>
    </div>
  );
}
