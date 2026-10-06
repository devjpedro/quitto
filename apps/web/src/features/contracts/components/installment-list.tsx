import { INSTALLMENT_STATUS, type Locale } from "@quitto/shared";
import { Fragment, useState } from "react";
import type { BarStatus } from "@/components/ui/installment-bar";
import { monthYearShort } from "@/lib/date-parts";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { ContractRoute } from "../hooks/use-contract-route";
import {
  counterpartLine,
  isSettled,
  type Perspective,
  perspectiveOf,
} from "../lib/contract-view";
import {
  groupInstallmentRows,
  groupTitle,
  type ListRow,
  type RowContext,
  rowView,
} from "../lib/installment-rows";
import type { ContractDetail, ContractInstallment } from "../types";
import { GroupRow, InstallmentRow, type RowTag } from "./installment-row";

type Group = Extract<ListRow, { kind: "group" }>;

const ITEM = "first:rounded-t-card last:rounded-b-card";
const GROUP_TONE: Record<Group["group"], BarStatus> = {
  paid: "paid",
  overdue: "overdue",
  tail: "open",
};

const groupKey = (group: Group) =>
  `${group.group}:${group.installments[0]?.id ?? ""}`;

function groupTag(
  group: Group,
  perspective: Perspective,
  locale: Locale
): RowTag {
  const options = { locale };
  if (group.group === "overdue") {
    return {
      tone: "danger",
      icon: "warning",
      text: m.contract_group_overdue({}, options),
    };
  }
  if (group.group === "tail") {
    return null;
  }
  if (
    group.installments.every((it) => it.status === INSTALLMENT_STATUS.confirmed)
  ) {
    return {
      tone: "brand",
      icon: "seal",
      text: m.contract_group_confirmed({}, options),
    };
  }
  return {
    tone: "brand",
    icon: "check",
    text:
      perspective === "receive"
        ? m.contract_group_received({}, options)
        : m.contract_group_paid({}, options),
  };
}

const sum = (items: ContractInstallment[]) =>
  items.reduce((total, it) => total + it.amountCents, 0);

const pad = (n: number | undefined) => String(n ?? 0).padStart(2, "0");

/**
 * The Parcelas tab (mockup 14, enxuto): one filled block, a line per
 * installment with its number on a tinted tile (the bar unrolled), the paid
 * ones at the start, the runs of overdue ones and the long tail grouped into
 * one line each that opens in place. No line carries a button: the card has
 * the next action, the panel the rest (DIRECAO › Lista de parcelas).
 */
export function InstallmentList({
  detail,
  route,
}: {
  detail: ContractDetail;
  route: ContractRoute;
}) {
  const locale = getLocale();
  const perspective = perspectiveOf(detail.role);
  const settled = isSettled(detail.installments);
  const rows = groupInstallmentRows(detail.installments, route.today, settled);
  const other = counterpartLine(detail.participants, perspective);
  const ctx: RowContext = {
    locale,
    perspective,
    settled,
    today: route.today,
    otherFirstName:
      other.kind === "receive" || other.kind === "pay"
        ? (other.name.split(" ")[0] ?? other.name)
        : null,
  };
  // Opened or closed by hand; otherwise a group is open while the URL's
  // installment is inside it (derived, no effect: decision 28).
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  // A group closed by hand gives way once the URL moves (review I2): the new
  // installment's group opens again, so its line is there, selected, to take
  // the focus back. Adjusted while rendering, as React's "storing information
  // from previous renders"; one opened by hand stays open.
  const [seen, setSeen] = useState(route.installmentId);
  if (seen !== route.installmentId) {
    setSeen(route.installmentId);
    setToggled((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([, open]) => open))
    );
  }
  const holdsSelected = (group: Group) =>
    group.installments.some((it) => it.id === route.installmentId);

  const line = (it: ContractInstallment) => (
    <li className={ITEM} key={it.id}>
      <InstallmentRow
        amountCents={it.amountCents}
        id={it.id}
        onOpen={route.openInstallment}
        selected={it.id === route.installmentId}
        sequence={it.sequence}
        view={rowView(it, ctx)}
      />
    </li>
  );

  return (
    <ul
      aria-label={m.contract_list_label()}
      className="divide-y divide-divider overflow-hidden rounded-card bg-surface-card"
      data-testid="installment-list"
    >
      {rows.map((row) => {
        if (row.kind === "one") {
          return line(row.installment);
        }
        const key = groupKey(row);
        const expanded = toggled[key] ?? holdsSelected(row);
        const first = row.installments[0];
        const last = row.installments.at(-1);
        return (
          <Fragment key={key}>
            <li className={ITEM}>
              <GroupRow
                amountCents={sum(row.installments)}
                expanded={expanded}
                ids={row.installments.map((it) => it.id).join(" ")}
                label={`${pad(first?.sequence)}–${pad(last?.sequence)}`}
                meta={
                  row.group === "tail" && first && last
                    ? m.contract_group_span({
                        from: monthYearShort(first.dueDate, locale),
                        to: monthYearShort(last.dueDate, locale),
                      })
                    : null
                }
                muted={row.group === "paid"}
                onToggle={() =>
                  setToggled((prev) => ({ ...prev, [key]: !expanded }))
                }
                tag={groupTag(row, perspective, locale)}
                title={groupTitle(row.installments, locale)}
                tone={GROUP_TONE[row.group]}
              />
            </li>
            {expanded ? row.installments.map(line) : null}
          </Fragment>
        );
      })}
    </ul>
  );
}
