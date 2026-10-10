import type {
  HomeAction,
  InstallmentAction,
  InviteAction,
  UpcomingItem,
} from "./home-types";

/**
 * Earliest due date first; then title and sequence; the installment id (unique)
 * breaks what is left, such as two "Aluguel" contracts with the same sequence
 * due the same day, so the order never depends on the input.
 */
export function byDueDate(a: UpcomingItem, b: UpcomingItem): number {
  return (
    a.dueDate.localeCompare(b.dueDate) ||
    a.contractTitle.localeCompare(b.contractTitle) ||
    a.sequence - b.sequence ||
    a.installmentId.localeCompare(b.installmentId)
  );
}

function mergeGroup(members: InstallmentAction[]): InstallmentAction {
  const sorted = [...members].sort(byDueDate);
  const [oldest] = sorted as [InstallmentAction, ...InstallmentAction[]];
  if (sorted.length === 1) {
    return oldest;
  }
  return {
    ...oldest,
    id: `overdue:${oldest.contractId}:${oldest.direction}`,
    count: sorted.length,
    installmentIds: sorted.map((action) => action.installmentId),
    sequences: sorted.map((action) => action.sequence),
    totalCents: sorted.reduce((sum, action) => sum + action.amountCents, 0),
    pixCode: null,
    canMarkPaid: false,
    canMarkReceived: false,
    canConfirm: false,
  };
}

/**
 * Overdue installments of one contract, in one direction, are one card
 * (DIRECAO › "Agrupe o que se repete"): the same situation is one decision.
 * The card's base fields are the oldest installment's, so "Pagar a mais
 * antiga" and the "desde" date read from it; a single one stays the card it
 * always was (id `installment:<id>`, count 1). A group has no PIX code (a
 * code is one amount) and no "Já paguei": each installment is paid in the
 * contract (paying many at once is out of this phase).
 */
export function groupOverdue(
  overdue: InstallmentAction[]
): InstallmentAction[] {
  const groups = new Map<string, InstallmentAction[]>();
  for (const action of overdue) {
    const key = `${action.contractId}:${action.direction}`;
    const members = groups.get(key);
    if (members) {
      members.push(action);
    } else {
      groups.set(key, [action]);
    }
  }
  return [...groups.values()].map(mergeGroup);
}

const INVITE_RANK = 4;

/** Overdue, due today, proofs to check, disputed proofs, (invites,) then what is due within 7 days. */
function rank(action: InstallmentAction, todayISO: string): number {
  switch (action.kind) {
    case "overdue":
      return 0;
    case "review":
      return 2;
    case "disputed":
      return 3;
    case "due_soon":
      return action.dueDate === todayISO ? 1 : 5;
    default: {
      // A new kind must get its rank here: one left out would fall to the end
      // in silence, and rank 4 (the invites') would drop it from the list.
      const unranked: never = action.kind;
      return unranked;
    }
  }
}

/**
 * The home's cards by urgency (owner's decision 7: what is due today comes
 * right after what is overdue). Same rank: the earliest due date first.
 */
export function orderActions(
  cards: InstallmentAction[],
  invites: InviteAction[],
  todayISO: string
): HomeAction[] {
  const sorted = [...cards].sort(
    (a, b) => rank(a, todayISO) - rank(b, todayISO) || byDueDate(a, b)
  );
  return [
    ...sorted.filter((card) => rank(card, todayISO) < INVITE_RANK),
    ...invites,
    ...sorted.filter((card) => rank(card, todayISO) > INVITE_RANK),
  ];
}
