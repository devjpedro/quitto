import { INSTALLMENT_STATUS } from "@quitto/shared";

export interface Capabilities {
  isApprover: boolean;
  isPayer: boolean;
}

export interface InstallmentActions {
  canConfirm: boolean;
  canDispute: boolean;
  /** marcar como paga (fluxo sem confirmação) */
  canMarkPaid: boolean;
  /** enviar/reenviar comprovante */
  canUpload: boolean;
}

/**
 * Espelho de UI do RBAC do backend (a autoridade). `isPayer`/`isApprover`
 * vêm prontos da API (GET /contracts/:id).
 */
export function availableActions(
  caps: Capabilities,
  requiresConfirmation: boolean,
  status: string
): InstallmentActions {
  const awaiting =
    requiresConfirmation && status === INSTALLMENT_STATUS.awaitingConfirmation;
  return {
    canUpload:
      caps.isPayer &&
      (status === INSTALLMENT_STATUS.pending ||
        status === INSTALLMENT_STATUS.disputed),
    canMarkPaid:
      caps.isPayer &&
      !requiresConfirmation &&
      status === INSTALLMENT_STATUS.pending,
    canConfirm: caps.isApprover && awaiting,
    canDispute: caps.isApprover && awaiting,
  };
}
