import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** GET /api/invites/:token — preview do convite (título, papel, emailMatches). */
export const inviteQueryOptions = (token: string) =>
  queryOptions({
    queryKey: queryKeys.invite(token),
    queryFn: () => unwrap(api.api.invites({ token }).get()),
  });

export function useInviteQuery(token: string) {
  return useQuery(inviteQueryOptions(token));
}

export function useAcceptInviteMutation(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.invites({ token }).accept.post()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contracts });
      qc.invalidateQueries({ queryKey: queryKeys.myInvites });
    },
  });
}
