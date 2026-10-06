export type ContractTabParam = "people" | "history";

const TABS: readonly string[] = ["people", "history"];

/**
 * The contract page's search: the installment open in the panel and the tab
 * (planner's decision 14; no tab is Parcelas). The old `status` filter is
 * gone with the old list (decision 13). Anything else is dropped.
 */
export function contractSearch(search: Record<string, unknown>): {
  installment?: string;
  tab?: ContractTabParam;
} {
  return {
    installment:
      typeof search.installment === "string" ? search.installment : undefined,
    tab:
      typeof search.tab === "string" && TABS.includes(search.tab)
        ? (search.tab as ContractTabParam)
        : undefined,
  };
}
