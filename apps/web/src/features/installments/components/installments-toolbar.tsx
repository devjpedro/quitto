import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { Locale } from "@quitto/shared";
import { FilterChips } from "@/components/ui/filter-chips";
import { IconButton } from "@/components/ui/icon-button";
import { m } from "@/paraglide/messages.js";
import type { InstallmentsSearch } from "../lib/installments-search";
import { monthTitle, shiftMonth } from "../lib/month-range";

type Filter = NonNullable<InstallmentsSearch["filter"]> | "all";

/**
 * The month (‹ name ›, "Este mês" off the current one) and the filter chips
 * (mockup 17, C). The chips with a count are there only when it is not zero,
 * or when chosen.
 */
export function InstallmentsToolbar({
  counts,
  current,
  filter,
  locale,
  month,
  onFilter,
  onMonth,
}: {
  counts: { awaiting: number; overdue: number };
  current: boolean;
  filter: InstallmentsSearch["filter"];
  locale: Locale;
  month: string;
  onFilter: (filter: InstallmentsSearch["filter"]) => void;
  onMonth: (month: string | undefined) => void;
}) {
  const options: { count?: number; label: string; value: Filter }[] = [
    { value: "all", label: m.installments_filter_all() },
    { value: "pay", label: m.installments_filter_pay() },
    { value: "receive", label: m.installments_filter_receive() },
  ];
  if (counts.overdue > 0 || filter === "overdue") {
    options.push({
      value: "overdue",
      label: m.installments_filter_overdue(),
      count: counts.overdue,
    });
  }
  if (counts.awaiting > 0 || filter === "awaiting") {
    options.push({
      value: "awaiting",
      label: m.installments_filter_awaiting(),
      count: counts.awaiting,
    });
  }
  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <div
        className="flex items-center justify-between gap-2 md:justify-start"
        data-testid="installments-month"
      >
        <IconButton
          className="bg-surface-card hover:bg-surface-card-hover"
          icon={CaretLeft}
          label={m.installments_month_prev()}
          onClick={() => onMonth(shiftMonth(month, -1))}
        />
        <div className="flex min-w-0 flex-col items-center md:flex-row md:gap-3">
          <span
            aria-live="polite"
            className="min-w-36 text-center font-display font-semibold text-[15px] tracking-[-0.01em]"
          >
            {monthTitle(month, locale)}
          </span>
          {current ? null : (
            <button
              className="rounded-control px-1.5 text-[13px] text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand max-md:min-h-11 max-md:px-3"
              onClick={() => onMonth(undefined)}
              type="button"
            >
              {m.installments_month_current()}
            </button>
          )}
        </div>
        <IconButton
          className="bg-surface-card hover:bg-surface-card-hover"
          icon={CaretRight}
          label={m.installments_month_next()}
          onClick={() => onMonth(shiftMonth(month, 1))}
        />
      </div>
      <div className="min-w-0" data-testid="installments-filters">
        <FilterChips<Filter>
          label={m.installments_filter_label()}
          onValueChange={(next) => onFilter(next === "all" ? undefined : next)}
          options={options}
          value={filter ?? "all"}
        />
      </div>
    </div>
  );
}
