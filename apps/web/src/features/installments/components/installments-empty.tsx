import { CalendarBlank, FunnelSimple, Plus } from "@phosphor-icons/react";
import type { Locale } from "@quitto/shared";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyStage } from "@/components/ui/empty-stage";
import { EmptyState } from "@/components/ui/empty-state";
import { TourButton } from "@/features/tour/components/tour-button";
import { formatMonthName } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import { shiftMonth } from "../lib/month-range";

/** The list with nothing to show (mockup 09, frame 4): no contracts, an empty month, or a filter with nothing. */
export function InstallmentsEmpty({
  filtered,
  currentMonth,
  hasContracts,
  locale,
  month,
  onClearFilter,
  onMonth,
}: {
  /** Today's month: past the contracts' end, "next" would lead to an empty month after another. */
  currentMonth: string;
  filtered: boolean;
  hasContracts: boolean;
  locale: Locale;
  month: string;
  onClearFilter: () => void;
  onMonth: (month: string | undefined) => void;
}) {
  const name = formatMonthName(month, locale);
  let body: React.ReactNode;
  if (!hasContracts) {
    body = (
      <EmptyStage
        actions={
          <>
            <Button asChild>
              <Link to="/contracts/new">
                <Plus aria-hidden="true" size={16} weight="bold" />
                {m.nav_new_contract()}
              </Link>
            </Button>
            <TourButton />
          </>
        }
        description={m.installments_empty_none_description()}
        icon={CalendarBlank}
        state="new"
        title={m.installments_empty_none_title()}
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
    const goBack = month > currentMonth;
    const target = goBack ? undefined : shiftMonth(month, 1);
    const targetName = formatMonthName(target ?? currentMonth, locale);
    body = (
      <EmptyStage
        actions={
          <Button onClick={() => onMonth(target)} variant="inset">
            {goBack
              ? m.installments_empty_back({ month: targetName })
              : m.installments_empty_next({ month: targetName })}
          </Button>
        }
        description={m.installments_empty_clear_description()}
        icon={CalendarBlank}
        state="done"
        title={m.installments_empty_clear_title({ month: name })}
      />
    );
  }
  return <div data-testid="installments-empty">{body}</div>;
}
