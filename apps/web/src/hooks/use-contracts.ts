import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** queryOptions reused by route loaders (ensureQueryData) and components (useQuery). */
export const contractsQueryOptions = queryOptions({
  queryKey: queryKeys.contracts,
  queryFn: () => unwrap(api.api.contracts.get()),
});

export function useContractsQuery() {
  return useQuery(contractsQueryOptions);
}
