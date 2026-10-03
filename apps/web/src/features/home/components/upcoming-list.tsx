import { CalendarBlank } from "@phosphor-icons/react";
import { INSTALLMENT_STATUS, type Locale } from "@quitto/shared";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Tag } from "@/components/ui/tag";
import { formatDate, formatMoney } from "@/lib/locale-format";
import { pluralForm } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { Home, UpcomingItem } from "../types";

/**
 * One upcoming installment. The row is a grid so a single tag can sit under
 * the date on a phone (the title keeps its room) and mid-row from md.
 */
function UpcomingRow({ item, locale }: { item: UpcomingItem; locale: Locale }) {
  const date = formatDate(item.dueDate, locale, "weekdayShort");
  const amount = formatMoney(item.amountCents, locale);
  const receive = item.direction === "receive";
  return (
    <Link
      className="grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto_auto] items-center gap-x-3 rounded-card border border-line bg-surface-raised px-3.5 py-3 transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:grid-cols-[minmax(0,1fr)_auto_auto] md:grid-rows-[auto_auto]"
      params={{ id: item.contractId }}
      search={{ installment: item.installmentId }}
      to="/contracts/$id"
    >
      <span className="col-start-1 row-start-1 block truncate font-medium text-sm">
        {item.contractTitle}
      </span>
      <span className="col-start-1 row-start-2 block text-ink-muted text-xs">
        {receive
          ? m.home_upcoming_receive({ date })
          : m.home_upcoming_pay({ date })}
      </span>
      {item.status === INSTALLMENT_STATUS.awaitingConfirmation ? (
        <Tag
          className="col-start-1 row-start-3 mt-1 justify-self-start whitespace-nowrap md:col-start-2 md:row-span-2 md:row-start-1 md:mt-0 md:self-center"
          tone="warning"
        >
          {m.home_upcoming_awaiting()}
        </Tag>
      ) : null}
      <span
        className={cn(
          "col-start-2 row-span-3 row-start-1 font-display text-base tabular-nums md:col-start-3 md:row-span-2",
          receive ? "text-brand" : "text-ink"
        )}
      >
        {receive ? m.home_amount_in({ amount }) : m.home_amount_out({ amount })}
      </span>
    </Link>
  );
}

/** The section "Ver próximos 30 dias" jumps to (AllClear). */
export const UPCOMING_SECTION_ID = "upcoming";

/** "Próximos 30 dias": what is coming that is not an action yet. */
export function UpcomingList({
  hasInstallmentActions,
  upcoming,
}: {
  /** Installment cards are on screen above the list (an invite card is not one). */
  hasInstallmentActions: boolean;
  upcoming: Home["upcoming"];
}) {
  const locale = getLocale();
  const titleId = useId();
  const total = upcoming.items.length + upcoming.moreCount;
  const one = (count: number) => pluralForm(count, locale) === "one";
  // Nothing listed, yet there are installment cards above (overdue ones count,
  // though the window total leaves them out) or money due in the window: it is
  // in the cards.
  const allInCards =
    upcoming.items.length === 0 &&
    (hasInstallmentActions ||
      upcoming.toPayCents + upcoming.toReceiveCents > 0);
  return (
    <section
      aria-labelledby={titleId}
      // The sticky top bar (~56 px) covers the title on a phone.
      className="flex scroll-mt-16 flex-col gap-2 rounded-card outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-surface-sunken md:scroll-mt-4 md:focus-visible:ring-offset-surface"
      id={UPCOMING_SECTION_ID}
      // Takes the focus when "Ver próximos 30 dias" jumps here; the ring keeps
      // 4 px off the text, in the page color (sunken on a phone, the panel from md).
      tabIndex={-1}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium text-ink-muted text-sm" id={titleId}>
          {m.home_upcoming_title()}
        </h2>
        {total > 0 ? (
          <span className="text-ink-muted text-sm tabular-nums">
            {one(total)
              ? m.home_upcoming_count_one()
              : m.home_upcoming_count_other({ count: total })}
          </span>
        ) : null}
      </div>
      {upcoming.items.length === 0 ? (
        <EmptyState
          description={
            allInCards
              ? m.home_upcoming_all_actions_description()
              : m.home_upcoming_empty_description()
          }
          icon={CalendarBlank}
          title={
            allInCards
              ? m.home_upcoming_all_actions_title()
              : m.home_upcoming_empty_title()
          }
          variant="compact"
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {upcoming.items.map((item) => (
            <li key={item.installmentId}>
              <UpcomingRow item={item} locale={locale} />
            </li>
          ))}
        </ul>
      )}
      {upcoming.moreCount > 0 ? (
        <p className="text-ink-muted text-sm">
          {one(upcoming.moreCount)
            ? m.home_upcoming_more_one()
            : m.home_upcoming_more_other({ count: upcoming.moreCount })}
        </p>
      ) : null}
    </section>
  );
}
