import { isOverdue, isPaidStatus } from "@quitto/shared";
import type { ContractDetail } from "../types";

/**
 * The cached contract with one installment changed (an optimistic mark, or
 * the entity a mutation answered with), the hero's numbers redone from the
 * installments. Pure: the cache keeps the old object for a rollback.
 */
export function withInstallmentPatch(
  detail: ContractDetail,
  id: string,
  patch: { confirmedAt?: string | null; paidAt: string | null; status: string },
  today: string
): ContractDetail {
  const installments = detail.installments.map((it) =>
    it.id === id ? { ...it, status: patch.status, paidAt: patch.paidAt } : it
  );
  const totalCents = installments.reduce((sum, it) => sum + it.amountCents, 0);
  const paidCents = installments
    .filter((it) => isPaidStatus(it.status))
    .reduce((sum, it) => sum + it.amountCents, 0);
  return {
    ...detail,
    installments,
    progress: {
      totalCents,
      paidCents,
      remainingCents: totalCents - paidCents,
      percent:
        totalCents === 0 ? 0 : Math.round((paidCents / totalCents) * 100),
      overdueCount: installments.filter((it) =>
        isOverdue(it.dueDate, it.status, today)
      ).length,
    },
  };
}
