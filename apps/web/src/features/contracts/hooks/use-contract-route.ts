import { todayISO } from "@quitto/shared";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";

export type ContractTab = "installments" | "people" | "history";

/**
 * The page's place in the URL (planner's decision 14): a tab change is a
 * history entry (the browser's back returns to the previous tab); opening,
 * stepping through and closing an installment replace it.
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
      }),
    [navigate]
  );
  const openInstallment = useCallback(
    (installmentId: string) =>
      navigate({
        search: (prev) => ({ ...prev, installment: installmentId }),
        replace: true,
      }),
    [navigate]
  );
  const closeInstallment = useCallback(
    () =>
      navigate({
        search: (prev) => ({ ...prev, installment: undefined }),
        replace: true,
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
