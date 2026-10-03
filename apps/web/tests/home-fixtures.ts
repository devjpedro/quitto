import type {
  Home,
  InstallmentAction,
  InviteAction,
  UpcomingItem,
} from "@/features/home/types";

export const TODAY = "2026-10-02";

export function installmentAction(
  over: Partial<InstallmentAction> = {}
): InstallmentAction {
  const installmentId = over.installmentId ?? "i1";
  const sequence = over.sequence ?? 7;
  const amountCents = over.amountCents ?? 125_000;
  return {
    id: `installment:${installmentId}`,
    kind: "due_soon",
    installmentId,
    contractId: "c1",
    contractTitle: "Aluguel do apê",
    sequence,
    installmentsCount: 12,
    amountCents,
    dueDate: "2026-10-03",
    direction: "pay",
    status: "pending",
    counterpartyName: "Maria Souza",
    pixCode: "000201pix",
    canMarkPaid: true,
    canConfirm: false,
    count: 1,
    installmentIds: [installmentId],
    sequences: [sequence],
    totalCents: amountCents,
    ...over,
  };
}

export function inviteAction(over: Partial<InviteAction> = {}): InviteAction {
  const token = over.token ?? "tok1";
  return {
    id: `invite:${token}`,
    kind: "invite",
    token,
    contractTitle: "Moto da Ana",
    role: "seller",
    inviterName: "Ana",
    ...over,
  };
}

export function upcomingItem(over: Partial<UpcomingItem> = {}): UpcomingItem {
  return {
    installmentId: "u1",
    contractId: "c2",
    contractTitle: "Celular da Ana",
    sequence: 9,
    installmentsCount: 10,
    amountCents: 32_000,
    dueDate: "2026-10-10",
    direction: "receive",
    status: "pending",
    ...over,
  };
}

export function homeFixture(over: Partial<Home> = {}): Home {
  return {
    today: TODAY,
    actions: [],
    overdue: { toPayCents: 0, toReceiveCents: 0 },
    upcoming: { items: [], moreCount: 0, toPayCents: 0, toReceiveCents: 0 },
    nextDue: null,
    milestones: {
      closestToPayoff: null,
      monthToDate: { month: "2026-10", paidCents: 0, receivedCents: 0 },
      previousMonthAllClear: null,
      settled: { paidCents: 0, receivedCents: 0 },
    },
    onboarding: {
      hasContract: true,
      hasPixKey: true,
      hasCounterparty: true,
      remindersOn: true,
      remindersAvailable: true,
      counterpartyContractId: "c1",
      dismissedAt: null,
    },
    unreadCount: 0,
    activeContractsCount: 0,
    ...over,
  };
}
