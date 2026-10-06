import {
  DIRECTION,
  type Direction,
  INSTALLMENT_STATUS,
  isOverdue,
  isPaidStatus,
} from "@quitto/shared";
import { addDays } from "./dates";
import { byDueDate, groupOverdue, orderActions } from "./home-groups";
import {
  type HomeInstallmentRow,
  type PartyContract,
  pixCodeFor,
} from "./home-parties";
import { type ContractSummary, contractSummary } from "./home-progress";
import type {
  HomeAgenda,
  HomeInviteRow,
  InstallmentAction,
  InstallmentActionKind,
  InviteAction,
  UpcomingItem,
} from "./home-types";

export const DUE_SOON_DAYS = 7;
export const UPCOMING_DAYS = 30;
export const UPCOMING_LIMIT = 8;

/** Which action, if any, an open installment asks of the caller. */
function classify(
  party: PartyContract,
  it: HomeInstallmentRow,
  todayISO: string,
  soonLimit: string
): InstallmentActionKind | null {
  if (it.status === INSTALLMENT_STATUS.awaitingConfirmation) {
    return party.caps.isApprover ? "review" : null;
  }
  if (
    it.status === INSTALLMENT_STATUS.disputed &&
    party.direction === DIRECTION.pay
  ) {
    return "disputed";
  }
  if (isOverdue(it.dueDate, it.status, todayISO)) {
    return "overdue";
  }
  return it.dueDate <= soonLimit ? "due_soon" : null;
}

function toUpcoming(
  party: PartyContract,
  it: HomeInstallmentRow
): UpcomingItem {
  return {
    installmentId: it.id,
    contractId: party.contract.id,
    contractTitle: party.contract.title,
    sequence: it.sequence,
    installmentsCount: party.contract.installmentsCount,
    amountCents: it.amountCents,
    dueDate: it.dueDate,
    direction: party.direction,
    status: it.status,
  };
}

function toAction(
  party: PartyContract,
  it: HomeInstallmentRow,
  kind: InstallmentActionKind,
  summary: ContractSummary
): InstallmentAction {
  const { caps, contract } = party;
  return {
    ...toUpcoming(party, it),
    id: `installment:${it.id}`,
    kind,
    count: 1,
    installmentIds: [it.id],
    sequences: [it.sequence],
    totalCents: it.amountCents,
    contract: summary,
    counterpartyName: party.counterpartyName,
    pixCode: kind === "review" ? null : pixCodeFor(party, it.amountCents),
    canMarkPaid:
      caps.isPayer &&
      !contract.requiresConfirmation &&
      it.status === INSTALLMENT_STATUS.pending,
    canMarkReceived:
      caps.isApprover &&
      (it.status === INSTALLMENT_STATUS.pending ||
        it.status === INSTALLMENT_STATUS.disputed),
    canConfirm:
      caps.isApprover &&
      contract.requiresConfirmation &&
      it.status === INSTALLMENT_STATUS.awaitingConfirmation,
  };
}

function toInviteAction(row: HomeInviteRow): InviteAction {
  return {
    id: `invite:${row.token}`,
    kind: "invite",
    token: row.token,
    contractTitle: row.contractTitle,
    role: row.role,
    inviterName: row.inviterName,
    installmentsCount: row.installmentsCount,
    amountCents: row.amountCents,
    totalCents: row.totalCents,
    firstDueDate: row.firstDueDate,
  };
}

function sumCents(items: UpcomingItem[], direction: Direction): number {
  let total = 0;
  for (const item of items) {
    if (item.direction === direction) {
      total += item.amountCents;
    }
  }
  return total;
}

/**
 * The home's agenda. Overdue installments of one contract and direction are
 * one card (home-groups). Cards by urgency: overdue, due today, proofs to
 * check, disputed proofs to resend, invites, then what is due within 7 days.
 * "Next 30 days" leaves out what is already a card (the totals don't) and
 * looks ahead only: what is overdue has a total of its own. nextDue is the
 * first open installment from today on, at any distance.
 */
export function buildAgenda(
  parties: PartyContract[],
  invites: HomeInviteRow[],
  todayISO: string
): HomeAgenda {
  const soonLimit = addDays(todayISO, DUE_SOON_DAYS);
  const windowEnd = addDays(todayISO, UPCOMING_DAYS);
  const installmentActions: InstallmentAction[] = [];
  const open: UpcomingItem[] = [];
  for (const party of parties) {
    const summary = contractSummary(party.installments, todayISO);
    for (const it of party.installments) {
      if (isPaidStatus(it.status)) {
        continue;
      }
      const kind = classify(party, it, todayISO, soonLimit);
      if (kind) {
        installmentActions.push(toAction(party, it, kind, summary));
      }
      if (it.dueDate >= todayISO) {
        open.push(toUpcoming(party, it));
      }
    }
  }
  const overdue = installmentActions.filter((a) => a.kind === "overdue");
  const cards = [
    ...groupOverdue(overdue),
    ...installmentActions.filter((a) => a.kind !== "overdue"),
  ];
  const inviteActions = [...invites]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toInviteAction);
  open.sort(byDueDate);
  const inWindow = open.filter((it) => it.dueDate <= windowEnd);
  const asAction = new Set(installmentActions.map((a) => a.installmentId));
  const listed = inWindow.filter((it) => !asAction.has(it.installmentId));
  return {
    actions: orderActions(cards, inviteActions, todayISO),
    overdue: {
      toPayCents: sumCents(overdue, DIRECTION.pay),
      toReceiveCents: sumCents(overdue, DIRECTION.receive),
    },
    nextDue: open[0] ?? null,
    upcoming: {
      items: listed.slice(0, UPCOMING_LIMIT),
      moreCount: Math.max(0, listed.length - UPCOMING_LIMIT),
      toPayCents: sumCents(inWindow, DIRECTION.pay),
      toReceiveCents: sumCents(inWindow, DIRECTION.receive),
    },
  };
}
