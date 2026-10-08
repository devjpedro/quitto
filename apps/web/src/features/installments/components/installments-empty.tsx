import { CalendarBlank, FunnelSimple } from "@phosphor-icons/react";
import type { Locale } from "@quitto/shared";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMonthName } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import { shiftMonth } from "../lib/month-range";

/** The list with nothing to show (mockup 09, frame 4): no contracts, an empty month, or a filter with nothing. */
export function InstallmentsEmpty({
  filtered,
  hasContracts,
  locale,
  month,
  onClearFilter,
  onMonth,
}: {
  filtered: boolean;
  hasContracts: boolean;
  locale: Locale;
  month: string;
  onClearFilter: () => void;
  onMonth: (month: string) => void;
}) {
  const name = formatMonthName(month, locale);
  let body: React.ReactNode;
  if (!hasContracts) {
    body = (
      <EmptyState
        action={
          <Button asChild size="sm" variant="inset">
            <Link to="/contracts/new">{m.nav_new_contract()}</Link>
          </Button>
        }
        description={m.installments_empty_none_description()}
        icon={CalendarBlank}
        title={m.installments_empty_none_title()}
        variant="compact"
      />
    );
  } else if (filtered) {
    body = (
      <EmptyState
        action={
          <Button onClick={onClearFilter} size="sm" variant="inset">
            {m.installments_empty_filter_action()}
          </Button>
        }
        description=""
        icon={FunnelSimple}
        title={m.installments_empty_filter_title({ month: name })}
        variant="compact"
      />
    );
  } else {
    const next = shiftMonth(month, 1);
    body = (
      <EmptyState
        action={
          <Button onClick={() => onMonth(next)} size="sm" variant="inset">
            {m.installments_empty_next({
              month: formatMonthName(next, locale),
            })}
          </Button>
        }
        description=""
        icon={CalendarBlank}
        title={m.installments_empty_month_title({ month: name })}
        variant="compact"
      />
    );
  }
  return <div data-testid="installments-empty">{body}</div>;
}
