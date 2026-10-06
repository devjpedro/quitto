import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ApiError, unwrap, unwrapOrNull } from "@/lib/api-client";
import { invalidateContractViews } from "@/lib/invalidate-contract-views";
import { queryKeys } from "@/lib/query-keys";
import { m } from "@/paraglide/messages.js";
import type { ContractDetail } from "./types";

/** null: the contract does not exist or is not yours (decision 20), and the page says so. */
export const contractQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.contract(id),
    queryFn: () => unwrapOrNull(api.api.contracts({ id }).get()),
  });

/** "Editar título e descrição": the page shows the new text at once. */
export function useUpdateContractMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { description: string | null; title: string }) =>
      unwrap(api.api.contracts({ id }).patch(body)),
    meta: { successMessage: m.contract_toast_updated() },
    onSuccess: (row) => {
      qc.setQueryData<ContractDetail>(
        queryKeys.contract(id),
        (detail) =>
          detail && {
            ...detail,
            contract: {
              ...detail.contract,
              title: row.title,
              description: row.description,
            },
          }
      );
      invalidateContractViews(qc);
    },
  });
}

export function useDeleteContractMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.api.contracts({ id }).delete()),
    meta: { successMessage: m.contract_toast_deleted() },
    onSuccess: (_result, id) => {
      qc.removeQueries({ queryKey: queryKeys.contract(id) });
      invalidateContractViews(qc);
    },
  });
}

export function useLeaveContractMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.contracts({ id }).me.delete()),
    meta: { successMessage: m.contract_toast_left() },
    onSuccess: () => {
      qc.removeQueries({ queryKey: queryKeys.contract(id) });
      invalidateContractViews(qc);
    },
  });
}

/**
 * The History tab (Task 8), 50 a page with an opaque cursor (Task 2); under
 * the contract's key, so invalidating the contract refreshes it. A null page:
 * the contract is gone (?tab=history on a deleted contract), as the contract's
 * own null says.
 */
export const contractEventsQueryOptions = (id: string) =>
  infiniteQueryOptions({
    queryKey: [...queryKeys.contract(id), "events"] as const,
    queryFn: ({ pageParam }) =>
      unwrapOrNull(
        api.api
          .contracts({ id })
          .events.get({ query: pageParam ? { before: pageParam } : {} })
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page?.nextBefore ?? null,
  });

function useContractInvalidate(contractId: string) {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: queryKeys.contract(contractId) });
}

/**
 * "Convidar pessoa": the person's slot and, with an e-mail, the invite (the
 * endpoints of today). Without an e-mail it is a contact known by name only
 * (spec §3: "contato sem e-mail", kept; review I6, decision 33).
 */
export function useInvitePersonMutation(contractId: string) {
  const invalidate = useContractInvalidate(contractId);
  return useMutation({
    mutationFn: async (input: {
      displayName: string;
      email: string | null;
      role: "buyer" | "seller" | "viewer";
    }) => {
      const created = await unwrap(
        api.api.contracts({ id: contractId }).participants.post({
          displayName: input.displayName,
          role: input.role,
          email: input.email,
        })
      );
      if (!input.email) {
        return { ...created, inviteFailed: false };
      }
      try {
        await unwrap(
          api.api
            .contracts({ id: contractId })
            .participants({ participantId: created.id })
            .invite.post({ email: input.email })
        );
      } catch (error) {
        // The person exists now: closing the dialog (and saying what is left to
        // do) beats a second submit that would add them again. A lost session
        // is another matter, and still an error.
        if (error instanceof ApiError && error.httpStatus === 401) {
          throw error;
        }
        return { ...created, inviteFailed: true };
      }
      return { ...created, inviteFailed: false };
    },
    // The toast depends on what was done, so not the static meta.successMessage.
    onSuccess: (done, input) => {
      if (done.inviteFailed) {
        toast.error(m.people_invite_failed());
        return;
      }
      toast.success(input.email ? m.people_invite_sent() : m.people_added());
    },
    onSettled: invalidate,
  });
}

export function useSendInviteMutation(contractId: string) {
  const invalidate = useContractInvalidate(contractId);
  return useMutation({
    mutationFn: (input: { email: string; participantId: string }) =>
      unwrap(
        api.api
          .contracts({ id: contractId })
          .participants({ participantId: input.participantId })
          .invite.post({ email: input.email })
      ),
    meta: { successMessage: m.people_invite_sent() },
    onSettled: invalidate,
  });
}

export function useResendInviteMutation(contractId: string) {
  const invalidate = useContractInvalidate(contractId);
  return useMutation({
    mutationFn: (participantId: string) =>
      unwrap(
        api.api
          .contracts({ id: contractId })
          .participants({ participantId })
          .invite.resend.post()
      ),
    meta: { successMessage: m.people_resent() },
    onSettled: invalidate,
  });
}

export function useRemoveParticipantMutation(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (participantId: string) =>
      unwrap(
        api.api
          .contracts({ id: contractId })
          .participants({ participantId })
          .delete()
      ),
    meta: { successMessage: m.people_removed() },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contract(contractId) });
      invalidateContractViews(qc);
    },
  });
}
