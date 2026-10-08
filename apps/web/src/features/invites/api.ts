import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { ApiError, unwrap } from "@/lib/api-client";
import { invalidateContractViews } from "@/lib/invalidate-contract-views";
import { queryKeys } from "@/lib/query-keys";
import { m } from "@/paraglide/messages.js";

type InviteGet = ReturnType<ReturnType<typeof api.api.invites>["get"]>;
export type InviteView = NonNullable<Awaited<InviteGet>["data"]>;

export type InviteLookup =
  | { kind: "view"; view: InviteView }
  | { kind: "guest" }
  | { kind: "missing" };

/**
 * One read decides the page (planner's decision 36): the signed-in view, or
 * "guest" (401: no session) or "missing" (404), so the page suspends on it
 * without an effect and the global error toast never fires for them.
 */
export const inviteLookupQueryOptions = (token: string) =>
  queryOptions({
    queryKey: queryKeys.invite(token),
    queryFn: async (): Promise<InviteLookup> => {
      try {
        const view = await unwrap(api.api.invites({ token }).get());
        return { kind: "view", view };
      } catch (error) {
        if (error instanceof ApiError && error.httpStatus === 401) {
          return { kind: "guest" };
        }
        if (error instanceof ApiError && error.httpStatus === 404) {
          return { kind: "missing" };
        }
        throw error;
      }
    },
  });

/** Accepting opens the contract (its screen is next; not optimistic, planner's decision 42). */
export function useAcceptInvite(token: string) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => unwrap(api.api.invites({ token }).accept.post()),
    meta: { successMessage: m.home_toast_invite_accepted() },
    onSuccess: ({ contractId }) => {
      // Back from the contract, the invite reads again (accepted), never a stale "Aceitar".
      qc.removeQueries({ queryKey: queryKeys.invite(token) });
      invalidateContractViews(qc);
      navigate({
        to: "/contracts/$id",
        params: { id: contractId },
        search: {},
      });
    },
  });
}

/** Declining answers with the view itself (Task 3): the page turns into "Você recusou". */
export function useDeclineInvite(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.invites({ token }).decline.post()),
    meta: { successMessage: m.home_toast_invite_declined() },
    onSuccess: (view) => {
      const next: InviteLookup = { kind: "view", view };
      qc.setQueryData(queryKeys.invite(token), next);
      qc.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
}

/** The owner's "Reenviar e-mail": the same link, a new deadline (planner's decision 10). */
export function useResendInvite(view: InviteView, token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(
        api.api
          .contracts({ id: view.contractId })
          .participants({ participantId: view.participantId })
          .invite.resend.post()
      ),
    meta: { successMessage: m.invite_resent() },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.invite(token) });
      invalidateContractViews(qc, view.contractId);
    },
  });
}
