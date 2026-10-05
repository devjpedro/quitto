import type { HomeContractRows } from "./home-parties";
import { activeContracts, barStatus } from "./home-progress";

/** At most this many contracts in the sidebar; "Ver todos (N)" covers the rest. */
export const SIDEBAR_CONTRACTS = 5;

export interface SidebarContract {
  contractId: string;
  hasOverdue: boolean;
  paidCount: number;
  title: string;
  totalCount: number;
}

/**
 * "Contratos ativos" in the sidebar (owner's decision 10): a fixed order, the
 * newest on top, so the list never jumps as installments get paid. Every
 * active contract the user sees counts, the followed ones included, and a
 * paid-off one never does: the same set as activeContractsCount, which
 * "Ver todos (N)" shows. The ring and the overdue mark read each installment
 * as the card's bar does (barStatus), so a disputed installment past due is
 * overdue here too (planner's decision 21).
 */
export function sidebarContracts(
  rows: HomeContractRows,
  todayISO: string
): SidebarContract[] {
  return activeContracts(rows)
    .sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() ||
        a.id.localeCompare(b.id)
    )
    .slice(0, SIDEBAR_CONTRACTS)
    .map((c) => {
      const statuses = rows.installments
        .filter((it) => it.contractId === c.id)
        .map((it) => barStatus(it, todayISO));
      return {
        contractId: c.id,
        title: c.title,
        totalCount: c.installmentsCount,
        paidCount: statuses.filter((status) => status === "paid").length,
        hasOverdue: statuses.includes("overdue"),
      };
    });
}
