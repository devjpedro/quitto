import type { Home, InstallmentAction, UpcomingItem } from "../types";

/** Below this many overdue cards in a direction, the chip would repeat a card (DIRECAO › Home enxuta). */
const CHIP_MIN_CARDS = 2;

/** The overdue chip of each direction: its total, or null while it would only repeat a card. */
export function overdueChips(home: Pick<Home, "actions" | "overdue">): {
  toPayCents: number | null;
  toReceiveCents: number | null;
} {
  const overdueCards = home.actions.filter(
    (action): action is InstallmentAction => action.kind === "overdue"
  );
  const count = (direction: "pay" | "receive") =>
    overdueCards.filter((card) => card.direction === direction).length;
  return {
    toPayCents: count("pay") >= CHIP_MIN_CARDS ? home.overdue.toPayCents : null,
    toReceiveCents:
      count("receive") >= CHIP_MIN_CARDS ? home.overdue.toReceiveCents : null,
  };
}

/** The title of "Próximos 30 dias": the rows of the list only, never what is already a card. */
export function upcomingTotals(items: UpcomingItem[]): {
  toPayCents: number;
  toReceiveCents: number;
} {
  let toPayCents = 0;
  let toReceiveCents = 0;
  for (const item of items) {
    if (item.direction === "receive") {
      toReceiveCents += item.amountCents;
    } else {
      toPayCents += item.amountCents;
    }
  }
  return { toPayCents, toReceiveCents };
}
