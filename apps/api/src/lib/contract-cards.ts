import {
  DIRECTION,
  type Direction,
  type InstallmentStatus,
  isPaidStatus,
} from "@quitto/shared";
import { capabilitiesFromRows, pickRecebedor } from "./contract-access";
import { computeNextDueDate, computeProgress } from "./contract-progress";
import type { ContractRows } from "./contract-rows";
import {
  counterpartyNameOf,
  groupBy,
  type HomeInstallmentRow,
} from "./home-parties";
import { type BarStatus, barStatus, contractSummary } from "./home-progress";

export interface ContractListItem {
  counterpartyName: string | null;
  createdAt: string;
  description: string | null;
  direction: Direction | null;
  disputedCount: number;
  endDate: string | null;
  id: string;
  installmentAmountCents: number | null;
  installmentsCount: number;
  monthly: boolean;
  next: {
    amountCents: number;
    dueDate: string;
    sequence: number;
    status: string;
  } | null;
  nextDueDate: string | null;
  oldestOverdue: { dueDate: string; sequence: number } | null;
  overdueCount: number;
  ownerRole: string;
  paidCents: number;
  paidCount: number;
  participantNames: string[];
  percent: number;
  remainingCents: number;
  reviewCount: number;
  settled: boolean;
  status: string;
  statuses: BarStatus[] | null;
  title: string;
  totalCents: number;
}

function directionOf(role: string | undefined): Direction | null {
  if (role === "buyer") {
    return DIRECTION.pay;
  }
  return role === "seller" ? DIRECTION.receive : null;
}

function byDueThenSequence(a: HomeInstallmentRow, b: HomeInstallmentRow) {
  return a.dueDate.localeCompare(b.dueDate) || a.sequence - b.sequence;
}

/** The caller's view of every contract they see: the list card, the ⌘K row and the old list share it. Pure. */
export function contractCards(
  userId: string,
  rows: ContractRows,
  today: string
): ContractListItem[] {
  const peopleBy = groupBy(rows.participants, (p) => p.contractId);
  const installmentsBy = groupBy(rows.installments, (i) => i.contractId);
  const users = new Map(rows.users.map((u) => [u.id, u]));
  return [...rows.contracts]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((c) => {
      const people = peopleBy.get(c.id) ?? [];
      const items = installmentsBy.get(c.id) ?? [];
      const caps = capabilitiesFromRows(userId, c, people);
      const direction = directionOf(caps?.role);
      const recebedor = pickRecebedor(c, people, users);
      const summary = contractSummary(items, today);
      const typed = items.map((i) => ({
        ...i,
        status: i.status as InstallmentStatus,
      }));
      const progress = computeProgress(typed, today);
      const ordered = [...items].sort(byDueThenSequence);
      const next = ordered.find((i) => !isPaidStatus(i.status));
      const oldestOverdue = ordered.find(
        (i) => barStatus(i, today) === "overdue"
      );
      const amounts = new Set(items.map((i) => i.amountCents));
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        participantNames: people.map((p) => p.displayName),
        ownerRole: c.ownerRole,
        status: c.status,
        totalCents: progress.totalCents,
        paidCents: progress.paidCents,
        percent: progress.percent,
        overdueCount: progress.overdueCount,
        installmentsCount: c.installmentsCount,
        nextDueDate: computeNextDueDate(typed),
        createdAt: c.createdAt.toISOString(),
        direction,
        counterpartyName: direction
          ? counterpartyNameOf(direction, recebedor, people)
          : null,
        paidCount: summary.paidCount,
        remainingCents: summary.remainingCents,
        statuses: summary.statuses,
        reviewCount: items.filter((i) => i.status === "awaiting_confirmation")
          .length,
        disputedCount: items.filter((i) => i.status === "disputed").length,
        installmentAmountCents:
          items.length > 0 && amounts.size === 1
            ? (items[0]?.amountCents ?? null)
            : null,
        monthly: c.monthlyAmountCents !== null,
        next: next
          ? {
              sequence: next.sequence,
              dueDate: next.dueDate,
              amountCents: next.amountCents,
              status: next.status,
            }
          : null,
        oldestOverdue: oldestOverdue
          ? {
              sequence: oldestOverdue.sequence,
              dueDate: oldestOverdue.dueDate,
            }
          : null,
        endDate: ordered.at(-1)?.dueDate ?? null,
        settled: items.length > 0 && items.every((i) => isPaidStatus(i.status)),
      };
    });
}
