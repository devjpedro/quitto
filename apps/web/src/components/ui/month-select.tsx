import type { Locale } from "@quitto/shared";
import { capitalize } from "@/lib/format";
import { Select, type SelectOption } from "./select";

interface MonthGroup {
  label: string;
  options: SelectOption[];
}

/** How many months the list reaches on each side of the shown one. */
const SPAN = 18;

function shift(month: string, delta: number): string {
  const index =
    Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + delta;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** "Outubro de 2026" / "October 2026". */
export function monthLabel(month: string, locale: Locale): string {
  return capitalize(
    new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${month}-01T00:00:00Z`))
  );
}

function monthName(month: string, locale: Locale): string {
  return capitalize(
    new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(
      new Date(`${month}-01T00:00:00Z`)
    )
  );
}

/** The months around `month`, a group per year ("2026": agosto … dezembro). */
function monthGroups(month: string, locale: Locale): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (let delta = -SPAN; delta <= SPAN; delta += 1) {
    const value = shift(month, delta);
    const year = value.slice(0, 4);
    let group = groups.at(-1);
    if (group?.label !== year) {
      group = { label: year, options: [] };
      groups.push(group);
    }
    group.options.push({
      value,
      label: monthName(value, locale),
    });
  }
  return groups;
}

/** The month as a Select: the title is the trigger ("Outubro de 2026"), the list is the months of the two years around it. */
export function MonthSelect({
  className,
  label,
  locale,
  month,
  onMonthChange,
}: {
  className?: string;
  label: string;
  locale: Locale;
  /** "2026-10". */
  month: string;
  onMonthChange: (month: string) => void;
}) {
  return (
    <Select
      className={className}
      display={monthLabel(month, locale)}
      groups={monthGroups(month, locale)}
      label={label}
      onValueChange={onMonthChange}
      value={month}
    />
  );
}
