import { todayISO } from "@quitto/shared";
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { withInstallmentPatch } from "@/features/contracts/lib/contract-cache";
import type { ContractDetail } from "@/features/contracts/types";
import { api } from "@/lib/api";
import { ApiError, unwrap, unwrapOrNull } from "@/lib/api-client";
import { invalidateContractViews } from "@/lib/invalidate-contract-views";
import { optimisticUpdate } from "@/lib/optimistic";
import { queryKeys } from "@/lib/query-keys";
import { m } from "@/paraglide/messages.js";

/**
 * GET /api/installments/:id (Task 1): what the panel draws. null: the
 * installment does not exist or is not yours (an old notification's link).
 */
export const installmentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.installment(id),
    queryFn: () =>
      unwrapOrNull(api.api.installments({ installmentId: id }).get()),
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

/** "Confirmar recebimento" (spec §7: optimistic, like "Já paguei"). */
export function useConfirmMutation(contractId: string) {
  return useInstallmentStatusMutation(
    contractId,
    (installmentId) =>
      unwrap(api.api.installments({ installmentId }).confirm.post()),
    "confirmed",
    m.panel_toast_confirmed()
  );
}

/** "Enviar contestação": not optimistic (the reason has to reach the payer). */
export function useDisputeMutation(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { installmentId: string; reason: string }) =>
      unwrap(
        api.api
          .installments({ installmentId: input.installmentId })
          .dispute.post({ reason: input.reason })
      ),
    meta: { successMessage: m.panel_toast_disputed() },
    onSuccess: (entity) => {
      qc.setQueryData<ContractDetail>(
        queryKeys.contract(contractId),
        (detail) =>
          detail && withInstallmentPatch(detail, entity.id, entity, todayISO())
      );
    },
    onSettled: (_r, _e, input) => {
      qc.invalidateQueries({
        queryKey: queryKeys.installment(input.installmentId),
      });
      invalidateContractViews(qc, contractId);
    },
  });
}

/** "Editar valor ou data" (owner): only the fields that changed (buildInstallmentPatch). */
export function useUpdateInstallmentMutation(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      body: { amountCents?: number; dueDate?: string };
      installmentId: string;
    }) =>
      unwrap(
        api.api
          .contracts({ id: contractId })
          .installments({ installmentId: input.installmentId })
          .patch(input.body)
      ),
    meta: { successMessage: m.panel_toast_updated() },
    onSettled: (_r, _e, input) => {
      qc.invalidateQueries({
        queryKey: queryKeys.installment(input.installmentId),
      });
      invalidateContractViews(qc, contractId);
    },
  });
}

/**
 * "Compartilhar recibo": creates or reuses the link (POST is idempotent) and
 * answers its public URL, or null when it was not created: the caller says
 * so in its own words ("O link do recibo não foi criado"), once, instead of
 * the generic toast every failed mutation gets. A 401 still throws (the
 * session gate takes it).
 */
export function useShareReceiptMutation(installmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ url: string } | null> => {
      try {
        const share = await unwrap(
          api.api.installments({ installmentId })["receipt-share"].post()
        );
        return { url: `${window.location.origin}/r/${share.token}` };
      } catch (error) {
        if (error instanceof ApiError && error.httpStatus === 401) {
          throw error;
        }
        return null;
      }
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: queryKeys.installment(installmentId) }),
  });
}
