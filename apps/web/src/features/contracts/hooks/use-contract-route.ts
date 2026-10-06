import { todayISO } from "@quitto/shared";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";

export type ContractTab = "installments" | "people" | "history";

/**
 * The page's place in the URL (planner's decision 14): a tab change is a
 * history entry (the browser's back returns to the previous tab); opening,
 * stepping through and closing an installment replace it. None of them
 * scrolls to the top (the router's default on every navigation): the tabs and
 * the list sit below the hero, and the page stays where the tap was.
 */
export function useContractRoute() {
  const { id } = useParams({ from: "/_app/contracts/$id" });
  const search = useSearch({ from: "/_app/contracts/$id" });
  const navigate = useNavigate({ from: "/contracts/$id" });
  const tab: ContractTab = search.tab ?? "installments";
  const setTab = useCallback(
    (next: ContractTab) =>
      navigate({
        search: (prev) => ({
          ...prev,
          tab: next === "installments" ? undefined : next,
        }),
        resetScroll: false,
      }),
    [navigate]
  );
  const openInstallment = useCallback(
    (installmentId: string) =>
      navigate({
        search: (prev) => ({ ...prev, installment: installmentId }),
        replace: true,
        resetScroll: false,
      }),
    [navigate]
  );
  const closeInstallment = useCallback(
    () =>
      navigate({
        search: (prev) => ({ ...prev, installment: undefined }),
        replace: true,
        resetScroll: false,
      }),
    [navigate]
  );
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
