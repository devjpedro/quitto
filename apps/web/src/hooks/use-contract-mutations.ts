import type {
  CreateContractInput,
  UpdateInstallmentInput,
} from "@quitto/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export function useCreateContractMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContractInput) =>
      unwrap(api.api.contracts.post(input)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contracts });
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contract(contractId) });
    },
  });
}
