import {
  CONTRACT_STATUS,
  type ContractStatus,
  DIRECTION,
  type Direction,
  type InstallmentStatus,
  isOverdue,
  isPaidStatus,
} from "@quitto/shared";

export type DashboardSlot = "buyer" | "seller" | "viewer";

export interface DashboardContractInput {
  contractId: string;
  installments: {
    id: string;
    sequence: number;
    amountCents: number;
    dueDate: string;
    status: InstallmentStatus;
  }[];
  status: ContractStatus;
  title: string;
  userSlot: DashboardSlot;
}

export interface UpcomingInstallment {
  amountCents: number;
  contractId: string;
  contractTitle: string;
  direction: Direction;
  dueDate: string;
  id: string;
  isOverdue: boolean;
  sequence: number;
}

export interface DashboardSummary {
  activeContractsCount: number;
  completedContractsCount: number;
  overdueCents: number;
  overdueCount: number;
  toPayCents: number;
  toReceiveCents: number;
  upcoming: UpcomingInstallment[];
}

const UPCOMING_LIMIT = 5;

export function computeDashboard(
  contracts: DashboardContractInput[],
  todayISO: string
): DashboardSummary {
  const summary: DashboardSummary = {
    toPayCents: 0,
    toReceiveCents: 0,
    overdueCount: 0,
    overdueCents: 0,
    activeContractsCount: 0,
    completedContractsCount: 0,
    upcoming: [],
  };
  const upcoming: UpcomingInstallment[] = [];

  for (const c of contracts) {
    if (c.userSlot === "viewer") {
      continue;
    }
    if (c.status === CONTRACT_STATUS.active) {
      summary.activeContractsCount += 1;
    } else if (c.status === CONTRACT_STATUS.completed) {
      summary.completedContractsCount += 1;
    }
    const direction: Direction =
      c.userSlot === "buyer" ? DIRECTION.pay : DIRECTION.receive;

    for (const it of c.installments) {
      if (isPaidStatus(it.status)) {
        continue;
      }
      if (direction === "pay") {
        summary.toPayCents += it.amountCents;
      } else {
        summary.toReceiveCents += it.amountCents;
      }
      const overdue = isOverdue(it.dueDate, it.status, todayISO);
      if (overdue) {
        summary.overdueCount += 1;
        summary.overdueCents += it.amountCents;
      }
      upcoming.push({
        id: it.id,
        contractId: c.contractId,
        contractTitle: c.title,
        sequence: it.sequence,
        amountCents: it.amountCents,
        dueDate: it.dueDate,
        direction,
        isOverdue: overdue,
      });
    }
  }

  upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  summary.upcoming = upcoming.slice(0, UPCOMING_LIMIT);
  return summary;
}
