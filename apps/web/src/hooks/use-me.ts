import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const SESSION_STALE_MS = 5 * 60_000;

export const meQueryOptions = queryOptions({
  queryKey: queryKeys.me,
  queryFn: () => unwrap(api.api.me.get()),
  staleTime: SESSION_STALE_MS,
});

export function useMeQuery() {
  return useQuery(meQueryOptions);
}
