import type {
  Home,
  InstallmentAction,
  InviteAction,
  UpcomingItem,
} from "@/features/home/types";

export const TODAY = "2026-10-02";

type ContractSummary = InstallmentAction["contract"];
type BarStatus = NonNullable<ContractSummary["statuses"]>[number];
type CardWithoutContract = Omit<InstallmentAction, "contract">;

/** The API's BAR_SEGMENTS_MAX: above it, statuses is null. */
const BAR_SEGMENTS_MAX = 24;

/** The card's own segment, by the API's precedence (home-progress barStatus). */
function cardStatus(card: CardWithoutContract): BarStatus {
  if (card.kind === "review" || card.status === "awaiting_confirmation") {
    return "review";
  }
  if (card.kind === "overdue" || card.dueDate < TODAY) {
    return "overdue";
  }
  return card.dueDate === TODAY ? "today" : "open";
}

/**
 * A contract summary that follows the card: what comes before its oldest
 * installment is paid, its own installments (one, or a group's) have the
 * card's status, and the rest is open. The default card (7 of 12, due
 * tomorrow) is 6 paid and 6 open.
 */
function contractFor(card: CardWithoutContract): ContractSummary {
  const own = new Set([card.sequence, ...card.sequences]);
  const first = Math.min(...own);
  const statuses = Array.from(
    { length: card.installmentsCount },
    (_, index): BarStatus => {
      const sequence = index + 1;
      if (own.has(sequence)) {
        return cardStatus(card);
      }
      return sequence < first ? "paid" : "open";
    }
  );
  const paidCount = statuses.filter((status) => status === "paid").length;
  return {
    paidCount,
    overdueCount: statuses.filter((status) => status === "overdue").length,
    remainingCents: (card.installmentsCount - paidCount) * card.amountCents,
    statuses: card.installmentsCount <= BAR_SEGMENTS_MAX ? statuses : null,
  };
}

export function installmentAction(
  over: Partial<InstallmentAction> = {}
): InstallmentAction {
  const { contract, ...rest } = over;
  const installmentId = rest.installmentId ?? "i1";
  const sequence = rest.sequence ?? 7;
  const amountCents = rest.amountCents ?? 125_000;
  const card: CardWithoutContract = {
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
    ...rest,
  };
  return { ...card, contract: contract ?? contractFor(card) };
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
      settled: {
        paidCents: 0,
        receivedCents: 0,
        payableTotalCents: 0,
        receivableTotalCents: 0,
      },
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
