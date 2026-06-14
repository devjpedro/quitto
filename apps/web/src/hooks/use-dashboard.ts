import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export const dashboardQueryOptions = queryOptions({
  queryKey: queryKeys.dashboard,
  queryFn: () => unwrap(api.api.dashboard.get()),
});

export function useDashboardQuery() {
  return useQuery(dashboardQueryOptions);
}
