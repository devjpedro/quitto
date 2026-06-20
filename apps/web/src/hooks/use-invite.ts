import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { FEEDBACK } from "@/lib/feedback";
import { invalidateContractViews } from "@/lib/invalidate-contract-views";
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
    meta: { successMessage: FEEDBACK.inviteAccepted },
    onSuccess: () => {
      invalidateContractViews(qc);
      qc.invalidateQueries({ queryKey: queryKeys.myInvites });
    },
  });
}

export function useDeclineInviteMutation(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.invites({ token }).decline.post()),
    meta: { successMessage: FEEDBACK.inviteDeclined },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myInvites });
    },
  });
}
