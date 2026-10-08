import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { goBack } from "@/lib/history-back";
import type { InstallmentsSearch } from "../lib/installments-search";
import type { InstallmentListItem, PanelRoute } from "../types";

const route = getRouteApi("/_app/installments");

/**
 * Parcelas' place in the URL: view, month, filter, day, and the installment
 * open in the panel (`installment` + `contract`). Like the contract page,
 * opening from closed pushes an entry marked `panel` (the phone's Back
 * closes the sheet); stepping with ↑ ↓ replaces it. Nothing here scrolls to
 * the top.
 */
export function useInstallmentsRoute(
  visible: InstallmentListItem[],
  today: string
) {
  const search = route.useSearch();
  const navigate = useNavigate({ from: "/installments" });
  const router = useRouter();
  const panelOpen = search.installment !== undefined;
  const panelPushed = useCallback(
    () => router.state.location.state.panel === true,
    [router]
  );
  const patch = useCallback(
    (next: Partial<InstallmentsSearch>, replace = false) =>
      navigate({
        search: (prev) => ({ ...prev, ...next }),
        replace,
        resetScroll: false,
      }),
    [navigate]
  );
  const openInstallment = useCallback(
    // `contractId` for an installment the list does not show on its own
    // (inside a collapsed line, or a card's button for the urgent contract).
    (installmentId: string, contractId?: string) => {
      const contract =
        contractId ??
        visible.find((it) => it.installmentId === installmentId)?.contractId;
      if (!contract) {
        return;
      }
      return navigate({
        search: (prev) => ({
          ...prev,
          installment: installmentId,
          contract,
        }),
        ...(panelOpen
          ? { replace: true, state: true as const }
          : { state: { panel: true } }),
        resetScroll: false,
      });
    },
    [navigate, panelOpen, visible]
  );
  const closeInstallment = useCallback(() => {
    if (panelPushed()) {
      return goBack(router);
    }
    return navigate({
      search: (prev) => ({
        ...prev,
        installment: undefined,
        contract: undefined,
      }),
      replace: true,
      resetScroll: false,
    });
  }, [navigate, panelPushed, router]);
  const panel: PanelRoute = {
    closeInstallment,
    installmentId: search.installment ?? null,
    neighbors: (id) => {
      const at = visible.findIndex((it) => it.installmentId === id);
      if (at === -1) {
        return { prev: null, next: null };
      }
      return {
        prev: visible[at - 1]?.installmentId ?? null,
        next: visible[at + 1]?.installmentId ?? null,
      };
    },
    openHistory: () => {
      const contractId = search.contract;
      if (contractId) {
        navigate({
          to: "/contracts/$id",
          params: { id: contractId },
          search: { tab: "history" },
        });
      }
    },
    openInstallment: (id) => openInstallment(id),
    today,
  };
  return {
    openWithContract: openInstallment,
    panel,
    search,
    setDay: (day: string | undefined) => patch({ day }, true),
    setFilter: (filter: InstallmentsSearch["filter"]) =>
      patch({ filter }, true),
    setMonth: (month: string | undefined) =>
      patch({ month, day: undefined }, true),
    setView: (view: InstallmentsSearch["view"]) => patch({ view }, true),
  };
}
