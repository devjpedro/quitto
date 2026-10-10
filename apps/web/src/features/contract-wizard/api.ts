import type { ContractRequestInput } from "@quitto/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { invalidateContractViews } from "@/lib/invalidate-contract-views";

/** POST /api/contracts; the wizard shows its own errors (on the field), so no global toast. */
export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ContractRequestInput) =>
      unwrap(api.api.contracts.post(body)),
    meta: { silentError: true },
    onSuccess: () => invalidateContractViews(qc),
  });
}
