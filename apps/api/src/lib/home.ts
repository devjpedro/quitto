import {
  DIRECTION,
  type Direction,
  INSTALLMENT_STATUS,
  isOverdue,
  isPaidStatus,
} from "@quitto/shared";
import { addDays } from "./dates";
import {
  type HomeInstallmentRow,
  type PartyContract,
  pixCodeFor,
} from "./home-parties";

export const DUE_SOON_DAYS = 7;
export const UPCOMING_DAYS = 30;
export const UPCOMING_LIMIT = 8;

export type InstallmentActionKind =
  | "overdue"
  | "review"
  | "disputed"
  | "due_soon";

export interface UpcomingItem {
  amountCents: number;
  contractId: string;
  contractTitle: string;
  direction: Direction;
  dueDate: string;
  installmentId: string;
  installmentsCount: number;
  sequence: number;
  status: string;
}

export interface InstallmentAction extends UpcomingItem {
  canConfirm: boolean;
  canMarkPaid: boolean;
  counterpartyName: string | null;
  id: string;
  kind: InstallmentActionKind;
  pixCode: string | null;
}

export interface InviteAction {
  contractTitle: string;
  id: string;
  inviterName: string;
  kind: "invite";
  role: string;
  token: string;
}

export type HomeAction = InstallmentAction | InviteAction;

export interface HomeInviteRow {
  contractId: string;
  contractTitle: string;
  createdAt: Date;
  inviterName: string;
  role: string;
  token: string;
}

export interface HomeAgenda {
  actions: HomeAction[];
  nextDue: UpcomingItem | null;
  upcoming: {
    items: UpcomingItem[];
    moreCount: number;
    toPayCents: number;
    toReceiveCents: number;
  };
}

const KIND_ORDER: Record<InstallmentActionKind, number> = {
  overdue: 0,
  review: 1,
  disputed: 2,
  due_soon: 3,
};

function byDueDate(a: UpcomingItem, b: UpcomingItem): number {
  return (
    a.dueDate.localeCompare(b.dueDate) ||
    a.contractTitle.localeCompare(b.contractTitle) ||
    a.sequence - b.sequence
  );
}

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
  kind: InstallmentActionKind
): InstallmentAction {
  const { caps, contract } = party;
  return {
    ...toUpcoming(party, it),
    id: `installment:${it.id}`,
    kind,
    counterpartyName: party.counterpartyName,
    pixCode: kind === "review" ? null : pixCodeFor(party, it.amountCents),
    canMarkPaid:
      caps.isPayer &&
      !contract.requiresConfirmation &&
      it.status === INSTALLMENT_STATUS.pending,
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
 * The home's agenda. Actions by urgency: overdue, proofs to check, disputed
 * proofs to resend, invites, then what is due within 7 days. "Next 30 days"
 * leaves out what is already an action (the totals don't). nextDue is the
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
    for (const it of party.installments) {
      if (isPaidStatus(it.status)) {
        continue;
      }
      const kind = classify(party, it, todayISO, soonLimit);
      if (kind) {
        installmentActions.push(toAction(party, it, kind));
      }
      if (it.dueDate >= todayISO) {
        open.push(toUpcoming(party, it));
      }
    }
  }
  installmentActions.sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || byDueDate(a, b)
  );
  const inviteActions = [...invites]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toInviteAction);
  open.sort(byDueDate);
  const inWindow = open.filter((it) => it.dueDate <= windowEnd);
  const asAction = new Set(installmentActions.map((a) => a.installmentId));
  const listed = inWindow.filter((it) => !asAction.has(it.installmentId));
  return {
    actions: [
      ...installmentActions.filter((a) => a.kind !== "due_soon"),
      ...inviteActions,
      ...installmentActions.filter((a) => a.kind === "due_soon"),
    ],
    nextDue: open[0] ?? null,
    upcoming: {
      items: listed.slice(0, UPCOMING_LIMIT),
      moreCount: Math.max(0, listed.length - UPCOMING_LIMIT),
      toPayCents: sumCents(inWindow, DIRECTION.pay),
      toReceiveCents: sumCents(inWindow, DIRECTION.receive),
    },
  };
}
