import type {
  CreateContractInput,
  UpdateInstallmentInput,
} from "@quitto/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { invalidateContractViews } from "@/lib/invalidate-contract-views";

export function useCreateContractMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContractInput) =>
      unwrap(api.api.contracts.post(input)),
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
    onSuccess: () => invalidateContractViews(qc, contractId),
  });
}
