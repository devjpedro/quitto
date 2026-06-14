import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ApiError, unwrap } from "@/lib/api-client";
import { FEEDBACK } from "@/lib/feedback";
import { invalidateContractViews } from "@/lib/invalidate-contract-views";
import type { ProofMime } from "@/lib/proof";
import { queryKeys } from "@/lib/query-keys";

function invalidatePayment(
  qc: QueryClient,
  contractId: string,
  installmentId: string
) {
  qc.invalidateQueries({ queryKey: queryKeys.installment(installmentId) });
  invalidateContractViews(qc, contractId);
}

/** presign → PUT (direto no storage) → confirm. `file.type` já foi validado em validateProofFile. */
export function useSubmitProofMutation(
  contractId: string,
  installmentId: string
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const mimeType = file.type as ProofMime;
      const presign = await unwrap(
        api.api
          .installments({ installmentId })
          .proofs.presign.post({ fileName: file.name, mimeType })
      );
      const put = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!put.ok) {
        throw new ApiError({
          code: "UPLOAD_FAILED",
          httpStatus: put.status,
          message: "Falha ao enviar o arquivo. Tente novamente.",
        });
      }
      return unwrap(
        api.api.installments({ installmentId }).proofs.post({
          objectKey: presign.objectKey,
          fileName: file.name,
          mimeType,
        })
      );
    },
    meta: { successMessage: FEEDBACK.proofSubmitted },
    onSuccess: () => invalidatePayment(qc, contractId, installmentId),
  });
}

export function useConfirmPaymentMutation(
  contractId: string,
  installmentId: string
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(api.api.installments({ installmentId }).confirm.post()),
    meta: { successMessage: FEEDBACK.paymentConfirmed },
    onSuccess: () => invalidatePayment(qc, contractId, installmentId),
  });
}

export function useDisputePaymentMutation(
  contractId: string,
  installmentId: string
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      unwrap(
        api.api
          .installments({ installmentId })
          .dispute.post(reason ? { reason } : {})
      ),
    meta: { successMessage: FEEDBACK.paymentDisputed },
    onSuccess: () => invalidatePayment(qc, contractId, installmentId),
  });
}

export function useMarkPaidMutation(contractId: string, installmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(api.api.installments({ installmentId })["mark-paid"].post()),
    meta: { successMessage: FEEDBACK.installmentPaid },
    onSuccess: () => invalidatePayment(qc, contractId, installmentId),
  });
}
