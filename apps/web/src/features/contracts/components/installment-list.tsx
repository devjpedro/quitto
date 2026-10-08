import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { ContractRoute } from "../hooks/use-contract-route";
import {
  counterpartLine,
  isSettled,
  perspectiveOf,
} from "../lib/contract-view";
import { type RowContext, rowView } from "../lib/installment-row-view";
import type { ContractDetail } from "../types";
import { InstallmentRow } from "./installment-row";

const ITEM = "first:rounded-t-card last:rounded-b-card";

/**
 * The Parcelas tab (mockup 14, enxuto): one filled block, a line per
 * installment with its number on a tinted tile (the bar unrolled), in order.
 * No grouping and no accordion (the owner found it confusing): every
 * installment has its own line. No line carries a button: the card has the
 * next action, the panel the rest (DIRECAO › Lista de parcelas).
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
  const installments = [...detail.installments].sort(
    (a, b) => a.sequence - b.sequence
  );
  return (
    <ul
      aria-label={m.contract_list_label()}
      className="divide-y divide-divider overflow-hidden rounded-card bg-surface-card"
      data-testid="installment-list"
    >
      {installments.map((it) => (
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
      ))}
    </ul>
  );
}
