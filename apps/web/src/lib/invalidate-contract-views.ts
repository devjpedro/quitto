import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

/**
 * Invalidates every view derived from contract/installment state. The dashboard
 * is a cross-contract aggregate, so any write must refresh it.
 */
export function invalidateContractViews(
  queryClient: QueryClient,
  contractId?: string
): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.contracts });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  if (contractId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.contract(contractId) });
  }
}
