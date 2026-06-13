import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** GET /api/invites/mine — convites pendentes do e-mail da sessão. */
export const myInvitesQueryOptions = queryOptions({
  queryKey: queryKeys.myInvites,
  queryFn: () => unwrap(api.api.invites.mine.get()),
});

export function useMyInvitesQuery() {
  return useQuery(myInvitesQueryOptions);
}
