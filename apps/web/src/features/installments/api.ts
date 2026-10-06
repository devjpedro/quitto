import { todayISO } from "@quitto/shared";
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { withInstallmentPatch } from "@/features/contracts/lib/contract-cache";
import type { ContractDetail } from "@/features/contracts/types";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { invalidateContractViews } from "@/lib/invalidate-contract-views";
import { optimisticUpdate } from "@/lib/optimistic";
import { queryKeys } from "@/lib/query-keys";
import { m } from "@/paraglide/messages.js";

/** GET /api/installments/:id (Task 1): what the panel draws. */
export const installmentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.installment(id),
    queryFn: () => unwrap(api.api.installments({ installmentId: id }).get()),
  });

interface Entity {
  confirmedAt: string | null;
  id: string;
  paidAt: string | null;
  status: string;
}

/**
 * One installment's status changed at once (spec §7 optimistic): the contract
 * and the installment's own detail show it now, a refusal puts both back, the
 * entity the API answers with is applied, and the aggregates refetch.
 */
function useInstallmentStatusMutation(
  contractId: string,
  call: (installmentId: string) => Promise<Entity>,
  optimisticStatus: string,
  successMessage: string
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: call,
    meta: { successMessage },
    onMutate: async (installmentId: string) => {
      const now = new Date().toISOString();
      const today = todayISO();
      const undoContract = await optimisticUpdate<ContractDetail>(
        qc,
        queryKeys.contract(contractId),
        (detail) =>
          detail &&
          withInstallmentPatch(
            detail,
            installmentId,
            { status: optimisticStatus, paidAt: now },
            today
          )
      );
      const undoDetail = await optimisticUpdate<{
        paidAt: string | null;
        status: string;
      }>(
        qc,
        queryKeys.installment(installmentId),
        (detail) =>
          detail && { ...detail, status: optimisticStatus, paidAt: now }
      );
      return {
        undo: () => {
          undoContract();
          undoDetail();
        },
      };
    },
    onError: (_error, _installmentId, context) => context?.undo(),
    onSuccess: (entity) => {
      qc.setQueryData<ContractDetail>(
        queryKeys.contract(contractId),
        (detail) =>
          detail && withInstallmentPatch(detail, entity.id, entity, todayISO())
      );
    },
    onSettled: (_result, _error, installmentId) => {
      qc.invalidateQueries({ queryKey: queryKeys.installment(installmentId) });
      invalidateContractViews(qc, contractId);
    },
  });
}

/** "Já paguei" (the payer, a contract without confirmation). */
export function useMarkPaidMutation(contractId: string) {
  return useInstallmentStatusMutation(
    contractId,
    (installmentId) =>
      unwrap(api.api.installments({ installmentId })["mark-paid"].post()),
    "paid",
    m.panel_toast_marked_paid()
  );
}

/** "Marcar como recebida" (the approver, owner's decision 2): confirmed with confirmation, paid without. */
export function useMarkReceivedMutation(
  contractId: string,
  requiresConfirmation: boolean
) {
  return useInstallmentStatusMutation(
    contractId,
    (installmentId) =>
      unwrap(api.api.installments({ installmentId })["mark-received"].post()),
    requiresConfirmation ? "confirmed" : "paid",
    m.panel_toast_marked_received()
  );
}
