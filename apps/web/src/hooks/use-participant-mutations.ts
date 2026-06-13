import type { AddParticipantInput, CreateInviteInput } from "@quitto/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export function useAddParticipantMutation(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddParticipantInput) =>
      unwrap(api.api.contracts({ id: contractId }).participants.post(body)),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.contract(contractId) }),
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
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.contract(contractId) }),
  });
}

export function useCreateInviteMutation(contractId: string) {
  return useMutation({
    mutationFn: ({
      participantId,
      body,
    }: {
      participantId: string;
      body: CreateInviteInput;
    }) =>
      unwrap(
        api.api
          .contracts({ id: contractId })
          .participants({ participantId })
          .invite.post(body)
      ),
  });
}
