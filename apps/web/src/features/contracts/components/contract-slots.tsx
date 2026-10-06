import { nextActionOf } from "../lib/next-action";
import type { ContractSlots } from "./contract-page";
import { InstallmentList } from "./installment-list";
import { NextActionCard } from "./next-action-card";

/**
 * What the route hands the contract page. Each later task swaps its own slot
 * here and never touches the route or the page: the next action's card and
 * the Parcelas tab (Task 7), Pessoas, Histórico, the recent activity and the
 * tabs' action (Task 8), the installment panel (Task 9). Until then a slot
 * draws nothing.
 */
export const CONTRACT_SLOTS: ContractSlots = {
  nextAction: (detail, route) => {
    const action = nextActionOf(detail, route.today);
    return action ? (
      <NextActionCard action={action} detail={detail} route={route} />
    ) : null;
  },
  panel: () => null,
  recentActivity: () => null,
  tabAction: () => null,
  tabBody: {
    installments: (detail, route) => (
      <InstallmentList detail={detail} route={route} />
    ),
    people: () => null,
    history: () => null,
  },
};
