import { todayISO } from "@quitto/shared";
import {
  useNavigate,
  useParams,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { useCallback } from "react";
import { neighborsOf } from "@/features/installments/lib/neighbors";
import type { PanelRoute } from "@/features/installments/types";
import { goBack } from "@/lib/history-back";
import type { ContractDetail } from "../types";

declare module "@tanstack/react-router" {
  interface HistoryState {
    /** The entry the contract pushed to open the installment panel. */
    panel?: boolean;
  }
}

export type ContractTab = "installments" | "people" | "history";

/**
 * The page's place in the URL (planner's decision 14): a tab change is a
 * history entry (the browser's back returns to the previous tab). Opening an
 * installment from the closed panel is one too, marked `panel` in its state
 * (review I2: the phone's Back closes the sheet and stays on the contract);
 * stepping through (↑ ↓, another line) replaces it and keeps the mark.
 * Closing the marked entry goes back to the one under it, so the ✕ and the
 * Back land in the same place; a panel opened by a link (a notification, a
 * home card) has no entry under it on the contract and closes by replacing.
 * None of them scrolls to the top (the router's default on every navigation):
 * the tabs and the list sit below the hero, and the page stays where the tap
 * was.
 */
export function useContractRoute() {
  const { id } = useParams({ from: "/_app/contracts/$id" });
  const search = useSearch({ from: "/_app/contracts/$id" });
  const navigate = useNavigate({ from: "/contracts/$id" });
  const router = useRouter();
  const tab: ContractTab = search.tab ?? "installments";
  const panelOpen = search.installment !== undefined;
  // Read when called, not at render: the entry may have changed since.
  const panelPushed = useCallback(
    () => router.state.location.state.panel === true,
    [router]
  );
  const setTab = useCallback(
    (next: ContractTab, options?: { closePanel?: boolean }) => {
      const closePanel = options?.closePanel === true;
      return navigate({
        search: (prev) => ({
          ...prev,
          tab: next === "installments" ? undefined : next,
          ...(closePanel ? { installment: undefined } : {}),
        }),
        // The panel's own entry gives its place to the tab: Back from there
        // returns to the list, not to the panel.
        replace: closePanel && panelPushed() ? true : undefined,
        resetScroll: false,
      });
    },
    [navigate, panelPushed]
  );
  const openInstallment = useCallback(
    (installmentId: string) =>
      navigate({
        search: (prev) => ({ ...prev, installment: installmentId }),
        ...(panelOpen
          ? { replace: true, state: true as const }
          : { state: { panel: true } }),
        resetScroll: false,
      }),
    [navigate, panelOpen]
  );
  const closeInstallment = useCallback(() => {
    if (panelPushed()) {
      return goBack(router);
    }
    return navigate({
      search: (prev) => ({ ...prev, installment: undefined }),
      replace: true,
      resetScroll: false,
    });
  }, [navigate, panelPushed, router]);
  return {
    id,
    installmentId: search.installment ?? null,
    tab,
    today: todayISO(),
    setTab,
    openInstallment,
    closeInstallment,
  };
}

export type ContractRoute = ReturnType<typeof useContractRoute>;

/**
 * The contract page's installment panel route: the same open/close the page
 * does, ↑ ↓ along the contract's installments by sequence, and "Histórico"
 * as the tab.
 */
export function useContractPanelRoute(
  detail: ContractDetail,
  route: ContractRoute
): PanelRoute {
  const { closeInstallment, installmentId, openInstallment, setTab, today } =
    route;
  const installments = detail.installments;
  return {
    closeInstallment,
    installmentId,
    neighbors: (id) => neighborsOf(installments, id),
    openHistory: (options) => setTab("history", options),
    openInstallment,
    today,
  };
}
