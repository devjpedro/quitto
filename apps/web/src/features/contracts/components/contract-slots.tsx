import { InstallmentPanelHost } from "@/features/installments/components/lazy-installment-panel-host";
import type { ContractRoute } from "../hooks/use-contract-route";
import { useContractPanelRoute } from "../hooks/use-contract-route";
import { nextActionOf } from "../lib/next-action";
import type { ContractDetail } from "../types";
import type { ContractSlots } from "./contract-page";
import { HistoryTab } from "./history-tab";
import { InstallmentList } from "./installment-list";
import { InviteButton } from "./invite-dialog";
import { NextActionCard } from "./next-action-card";
import { PeopleTab } from "./people-tab";
import { RecentActivity } from "./recent-activity";

function ContractPanel({
  detail,
  route,
}: {
  detail: ContractDetail;
  route: ContractRoute;
}) {
  return (
    <InstallmentPanelHost
      contract={detail}
      route={useContractPanelRoute(detail, route)}
    />
  );
}

/**
 * What the route hands the contract page. Each later task swaps its own slot
 * here and never touches the route or the page: the next action's card and
 * the Parcelas tab (Task 7), Pessoas, Histórico, the recent activity and the
 * tabs' action (Task 8), the installment panel (Task 9).
 */
export const CONTRACT_SLOTS: ContractSlots = {
  nextAction: (detail, route) => {
    const action = nextActionOf(detail, route.today);
    return action ? (
      <NextActionCard action={action} detail={detail} route={route} />
    ) : null;
  },
  panel: (detail, route) => <ContractPanel detail={detail} route={route} />,
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
