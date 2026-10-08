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
import { InstallmentListRow, InstallmentRunRow } from "./installment-list-row";

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
 * filled block with straight dividers. A run of overdue installments is one
 * line that opens in place (decision 3).
 */
export function InstallmentsList({
  expanded,
  groups,
  locale,
  month,
  onIntent,
  onOpen,
  onToggle,
  selectedId,
  today,
}: {
  expanded: ReadonlySet<string>;
  groups: InstallmentGroup[];
  locale: Locale;
  month: string;
  onIntent: (item: InstallmentListItem) => void;
  onOpen: (id: string) => void;
  onToggle: (lineId: string) => void;
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
              {group.lines.flatMap((line) => {
                const view = installmentLineView(line, group.id, today, locale);
                const [first] = line.items;
                if (!first) {
                  return [];
                }
                if (line.items.length === 1) {
                  return [
                    <li
                      className="first:rounded-t-card last:rounded-b-card"
                      key={line.id}
                    >
                      <InstallmentListRow
                        item={first}
                        locale={locale}
                        onIntent={onIntent}
                        onOpen={onOpen}
                        selected={selectedId === first.installmentId}
                        view={view}
                      />
                    </li>,
                  ];
                }
                const open = expanded.has(line.id);
                const rows = [
                  <li
                    className="first:rounded-t-card last:rounded-b-card"
                    key={line.id}
                  >
                    <InstallmentRunRow
                      expanded={open}
                      items={line.items}
                      locale={locale}
                      onToggle={() => onToggle(line.id)}
                      view={view}
                    />
                  </li>,
                ];
                if (open) {
                  for (const item of line.items) {
                    rows.push(
                      <li
                        className="bg-surface-card-hover/40 last:rounded-b-card"
                        key={item.installmentId}
                      >
                        <InstallmentListRow
                          item={item}
                          locale={locale}
                          onIntent={onIntent}
                          onOpen={onOpen}
                          selected={selectedId === item.installmentId}
                          view={installmentLineView(
                            { id: item.installmentId, items: [item] },
                            group.id,
                            today,
                            locale
                          )}
                        />
                      </li>
                    );
                  }
                }
                return rows;
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
