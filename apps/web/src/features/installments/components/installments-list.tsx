import type { Locale } from "@quitto/shared";
import { useId } from "react";
import { Money } from "@/components/ui/money";
import { SectionTitle } from "@/components/ui/section-title";
import { formatMonthName } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import {
  type InstallmentGroup,
  isCurrentMonth,
} from "../lib/installment-groups";
import { installmentLineView } from "../lib/installment-line-view";
import type { InstallmentListItem } from "../types";
import { InstallmentListRow } from "./installment-list-row";

function groupTitle(
  group: InstallmentGroup,
  month: string,
  today: string,
  locale: Locale
): string {
  const name = formatMonthName(month, locale);
  switch (group.id) {
    case "overdue":
      return m.installments_group_overdue();
    case "awaiting":
      return m.installments_group_awaiting();
    case "week":
      return m.installments_group_week();
    case "paid":
      return m.installments_group_paid({ month: name });
    default:
      return isCurrentMonth(month, today)
        ? m.installments_group_rest({ month: name })
        : m.installments_group_month({ month: name });
  }
}

/** What the rows add up to, by direction and never summed: the sign and the color say the side. */
function GroupTotals({ group }: { group: InstallmentGroup }) {
  return (
    <>
      {group.receiveCents > 0 ? (
        <span className="font-semibold text-brand">
          <Money cents={group.receiveCents} sign="+" />
          <span className="sr-only"> {m.installments_total_receive()}</span>
        </span>
      ) : null}
      {group.receiveCents > 0 && group.payCents > 0 ? (
        <span aria-hidden="true">·</span>
      ) : null}
      {group.payCents > 0 ? (
        <span className="font-semibold text-ink">
          <Money cents={group.payCents} sign="−" />
          <span className="sr-only"> {m.installments_total_pay()}</span>
        </span>
      ) : null}
    </>
  );
}

/**
 * The month's groups (mockup 17, C): each a title with its total and one
 * filled block with straight dividers, one line per installment.
 */
export function InstallmentsList({
  groups,
  locale,
  month,
  onIntent,
  onOpen,
  selectedId,
  today,
}: {
  groups: InstallmentGroup[];
  locale: Locale;
  month: string;
  onIntent: (item: InstallmentListItem) => void;
  onOpen: (id: string) => void;
  selectedId: string | null;
  today: string;
}) {
  const baseId = useId();
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {groups.map((group) => {
        const titleId = `${baseId}-${group.id}`;
        return (
          <section
            aria-labelledby={titleId}
            data-testid={`installments-group-${group.id}`}
            key={group.id}
          >
            <SectionTitle aux={<GroupTotals group={group} />} id={titleId}>
              {groupTitle(group, month, today, locale)}
            </SectionTitle>
            <ul className="divide-y divide-divider overflow-hidden rounded-card bg-surface-card">
              {group.lines.map((line) => {
                const [item] = line.items;
                if (!item) {
                  return null;
                }
                return (
                  <li
                    className="first:rounded-t-card last:rounded-b-card"
                    key={line.id}
                  >
                    <InstallmentListRow
                      item={item}
                      locale={locale}
                      onIntent={onIntent}
                      onOpen={onOpen}
                      selected={selectedId === item.installmentId}
                      view={installmentLineView(line, group.id, today, locale)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
