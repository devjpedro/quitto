import type {
  CreateContractInput,
  UpdateInstallmentInput,
} from "@quitto/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { FEEDBACK } from "@/lib/feedback";
import { invalidateContractViews } from "@/lib/invalidate-contract-views";

export function useCreateContractMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContractInput) =>
      unwrap(api.api.contracts.post(input)),
    meta: { successMessage: FEEDBACK.contractCreated },
    onSuccess: () => invalidateContractViews(qc),
  });
}

export function useUpdateInstallmentMutation(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      installmentId: string;
      body: UpdateInstallmentInput;
    }) =>
      unwrap(
        api.api
          .contracts({ id: contractId })
          .installments({ installmentId: vars.installmentId })
          .patch(vars.body)
      ),
    meta: { successMessage: FEEDBACK.installmentUpdated },
    onSuccess: () => invalidateContractViews(qc, contractId),
  });
}

export function useDeleteContractMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contractId: string) =>
      unwrap(api.api.contracts({ id: contractId }).delete()),
    meta: { successMessage: FEEDBACK.contractDeleted },
    onSuccess: () => invalidateContractViews(qc),
  });
}

export function useLeaveContractMutation(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.contracts({ id: contractId }).me.delete()),
    meta: { successMessage: FEEDBACK.contractLeft },
    onSuccess: () => invalidateContractViews(qc),
  });
}
