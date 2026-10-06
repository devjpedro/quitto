import { NOTIFICATION_TYPE } from "@quitto/shared";
import type { NotificationItem } from "@/features/notifications/types";
import type { HomeAction, InstallmentAction } from "../types";

const OVERDUE: ReadonlySet<string> = new Set([
  NOTIFICATION_TYPE.installmentOverdue,
  NOTIFICATION_TYPE.installmentOverdueReceivable,
]);
const DUE_SOON: ReadonlySet<string> = new Set([
  NOTIFICATION_TYPE.installmentDueSoon,
  NOTIFICATION_TYPE.installmentDueSoonReceivable,
]);

function covers(card: InstallmentAction, item: NotificationItem): boolean {
  if (item.type === NOTIFICATION_TYPE.proofSubmitted) {
    return card.kind === "review" && card.installmentId === item.installmentId;
  }
  if (item.type === NOTIFICATION_TYPE.paymentDisputed) {
    return (
      card.kind === "disputed" && card.installmentId === item.installmentId
    );
  }
  if (OVERDUE.has(item.type)) {
    return card.kind === "overdue" && card.contractId === item.contractId;
  }
  if (DUE_SOON.has(item.type)) {
    return (
      item.installmentId !== null &&
      card.installmentIds.includes(item.installmentId)
    );
  }
  return false;
}

/**
 * "Notificações recentes" keeps only what no action card already says
 * (DIRECAO › Home enxuta): a proof is the "Aguarda você" card, a dispute is
 * the payer's "Contestada" card, an overdue reminder is the contract's
 * overdue card, a due-soon one is its card. The bell keeps everything.
 */
export function withoutCards(
  items: NotificationItem[],
  actions: HomeAction[]
): NotificationItem[] {
  const cards = actions.filter(
    (action): action is InstallmentAction => action.kind !== "invite"
  );
  return items.filter((item) => !cards.some((card) => covers(card, item)));
}
