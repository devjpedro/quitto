import { CalendarBlank, CaretRight } from "@phosphor-icons/react";
import { INSTALLMENT_STATUS, type Locale } from "@quitto/shared";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { DateTile } from "@/components/ui/date-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/money";
import { SectionTitle } from "@/components/ui/section-title";
import { Tag } from "@/components/ui/tag";
import { weekdayName } from "@/lib/date-parts";
import { sequencesLabel } from "@/lib/sequences-label";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { Home, UpcomingItem } from "../types";

/** "Próximos 30 dias" shows this many lines; the rest is "Mais N em Parcelas". */
export const UPCOMING_MAX = 3;

/** "última" for a contract's last installment, "primeira" for its first. */
function edgeTag(item: UpcomingItem): string | null {
  if (item.sequence === item.installmentsCount) {
    return m.home_upcoming_last();
  }
  return item.sequence === 1 ? m.home_upcoming_first() : null;
}

/**
 * One upcoming installment (mockup 13): the date tile as its anchor, the
 * contract, the weekday, and the amount with its sign (the side is the sign and
 * the color). The installment number joins the meta from md (a phone keeps
 * the row short), and only when no first/last tag already places the row.
 */
function UpcomingRow({ item, locale }: { item: UpcomingItem; locale: Locale }) {
  const receive = item.direction === "receive";
  const edge = edgeTag(item);
  const date = weekdayName(item.dueDate, locale);
  return (
    <Link
      className="flex min-h-16 flex-1 items-center gap-3.5 rounded-[inherit] py-2.5 pr-4 pl-2.5 transition-colors hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      params={{ id: item.contractId }}
      search={{ installment: item.installmentId }}
      to="/contracts/$id"
    >
      <DateTile iso={item.dueDate} locale={locale} />
      <span className="min-w-0 flex-1">
        {/* The tags never shrink: on a narrow row they wrap below the title
            instead of eating it. */}
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-medium text-sm">
          <span className="truncate">{item.contractTitle}</span>
          {edge ? (
            <Tag className="self-center" tone="brand">
              {edge}
            </Tag>
          ) : null}
          {item.status === INSTALLMENT_STATUS.awaitingConfirmation ? (
            <Tag className="self-center" tone="warning">
              {m.home_upcoming_awaiting()}
            </Tag>
          ) : null}
        </span>
        <span className="mt-[3px] block truncate text-[12.5px] text-ink-muted tabular-nums">
          {date}
          {edge ? null : (
            <span className="max-md:hidden">
              {" "}
              {m.home_dot_after({
                text: sequencesLabel(
                  [item.sequence],
                  item.installmentsCount,
                  locale
                ),
              })}
            </span>
          )}
        </span>
      </span>
      <Money
        cents={item.amountCents}
        className={cn("shrink-0", receive ? "text-brand" : "text-ink")}
        sign={receive ? "+" : "−"}
        size="list"
      />
    </Link>
  );
}

/** The section "Ver próximos 30 dias" jumps to (AllClear). */
export const UPCOMING_SECTION_ID = "upcoming";

/** "Próximos 30 dias": what is coming that is not a card yet, as one filled block with straight dividers. */
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
  const shown = upcoming.items.slice(0, UPCOMING_MAX);
  const more = upcoming.items.length - shown.length + upcoming.moreCount;
  // Nothing listed, yet there are installment cards above or money due in
  // the window: it is in the cards.
  const allInCards =
    upcoming.items.length === 0 &&
    (hasInstallmentActions ||
      upcoming.toPayCents + upcoming.toReceiveCents > 0);
  return (
    <section
      aria-labelledby={titleId}
      // The sticky top bar (~56 px) covers the title on a phone. Takes the
      // focus when "Ver próximos 30 dias" jumps here; the ring keeps 4 px off,
      // in the page color (sunken on a phone, the panel from md).
      className="flex scroll-mt-16 flex-col rounded-card outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-surface-sunken md:scroll-mt-4 md:focus-visible:ring-offset-surface"
      id={UPCOMING_SECTION_ID}
      tabIndex={-1}
    >
      <SectionTitle
        aux={
          more > 0 ? (
            <Link
              className="inline-flex items-center gap-1 rounded-control font-medium text-ink text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              search={{}}
              to="/installments"
            >
              {m.home_upcoming_see_more({ count: more })}
              <CaretRight aria-hidden="true" size={14} />
            </Link>
          ) : null
        }
        id={titleId}
      >
        {m.home_upcoming_title()}
      </SectionTitle>
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
        <ul className="flex flex-1 flex-col divide-y divide-divider overflow-hidden rounded-card bg-surface-card">
          {shown.map((item) => (
            // The first and last rows take the block's corners (the row
            // inherits them), so the inset focus ring follows the curve
            // instead of being clipped by it.
            <li
              className="flex flex-1 flex-col first:rounded-t-card last:rounded-b-card"
              key={item.installmentId}
            >
              <UpcomingRow item={item} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
