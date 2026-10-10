export interface ContractsListSearch {
  show?: "done";
  side?: "pay" | "receive";
}

/**
 * The list's search: Concluídos and the side filter. The defaults (Ativos,
 * Todos) are omitted from the URL; anything else is dropped.
 */
export function contractsListSearch(
  search: Record<string, unknown>
): ContractsListSearch {
  return {
    show: search.show === "done" ? "done" : undefined,
    side:
      search.side === "pay" || search.side === "receive"
        ? search.side
        : undefined,
  };
}
