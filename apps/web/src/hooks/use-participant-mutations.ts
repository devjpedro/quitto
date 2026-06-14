import type { AddParticipantInput, CreateInviteInput } from "@quitto/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { invalidateContractViews } from "@/lib/invalidate-contract-views";

/** Papéis atribuíveis a um participante (owner não é selecionável). */
type AssignableRole = AddParticipantInput["role"];

export function useAddParticipantMutation(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddParticipantInput) =>
      unwrap(api.api.contracts({ id: contractId }).participants.post(body)),
    onSuccess: () => invalidateContractViews(qc, contractId),
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
    onSuccess: () => invalidateContractViews(qc, contractId),
  });
}

export function useUpdateParticipantRoleMutation(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      participantId,
      role,
    }: {
      participantId: string;
      role: AssignableRole;
    }) =>
      unwrap(
        api.api
          .contracts({ id: contractId })
          .participants({ participantId })
          .patch({ role })
      ),
    onSuccess: () => invalidateContractViews(qc, contractId),
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
