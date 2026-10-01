import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { FEEDBACK } from "@/lib/feedback";
import { queryKeys } from "@/lib/query-keys";

const share = (installmentId: string) =>
  api.api.installments({ installmentId })["receipt-share"];

/** Só busca quando a gaveta é de uma parcela paga e o usuário é o dono. */
export function useReceiptShareQuery(installmentId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.receiptShare(installmentId),
    queryFn: () => unwrap(share(installmentId).get()),
    enabled,
  });
}

export function useCreateReceiptShareMutation(installmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(share(installmentId).post()),
    onSuccess: async (data) => {
      const queryKey = queryKeys.receiptShare(installmentId);
      // Evita que um GET em voo sobrescreva o share recém-criado com null.
      await qc.cancelQueries({ queryKey });
      qc.setQueryData(queryKey, data);
    },
  });
}

export function useRevokeReceiptShareMutation(installmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(share(installmentId).delete()),
    meta: { successMessage: FEEDBACK.receiptShareRevoked },
    onSuccess: () =>
      qc.setQueryData(queryKeys.receiptShare(installmentId), null),
  });
}
