import type { CreateContractInput } from "@quitto/shared";
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
