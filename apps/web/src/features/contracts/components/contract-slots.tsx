import { nextActionOf } from "../lib/next-action";
import type { ContractSlots } from "./contract-page";
import { HistoryTab } from "./history-tab";
import { InstallmentList } from "./installment-list";
import { InviteButton } from "./invite-dialog";
import { NextActionCard } from "./next-action-card";
import { PeopleTab } from "./people-tab";
import { RecentActivity } from "./recent-activity";

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
  recentActivity: (detail, route) => (
    <RecentActivity detail={detail} route={route} />
  ),
  tabAction: (detail, route) =>
    route.tab === "people" && detail.isOwner ? (
      <InviteButton detail={detail} />
    ) : null,
  tabBody: {
    installments: (detail, route) => (
      <InstallmentList detail={detail} route={route} />
    ),
    people: (detail) => <PeopleTab detail={detail} />,
    history: (_detail, route) => <HistoryTab route={route} />,
  },
};
