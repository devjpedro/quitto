import { INSTALLMENT_STATUS, PARTICIPANT_ROLE } from "@quitto/shared";

export interface InstallmentActions {
  canConfirm: boolean;
  canDispute: boolean;
  /** marcar como paga (fluxo sem confirmação) */
  canMarkPaid: boolean;
  /** enviar/reenviar comprovante */
  canUpload: boolean;
}

/**
 * Pure UI mirror of the 3a RBAC + state machine. The backend remains the
 * authority; this only decides which buttons to show.
 */
export function availableActions(
  role: string,
  requiresConfirmation: boolean,
  status: string
): InstallmentActions {
  const isPayer =
    role === PARTICIPANT_ROLE.owner || role === PARTICIPANT_ROLE.buyer;
  const isApprover =
    role === PARTICIPANT_ROLE.owner || role === PARTICIPANT_ROLE.seller;
  const awaiting =
    requiresConfirmation && status === INSTALLMENT_STATUS.awaitingConfirmation;
  return {
    canUpload:
      isPayer &&
      (status === INSTALLMENT_STATUS.pending ||
        status === INSTALLMENT_STATUS.disputed),
    canMarkPaid:
      isPayer && !requiresConfirmation && status === INSTALLMENT_STATUS.pending,
    canConfirm: isApprover && awaiting,
    canDispute: isApprover && awaiting,
  };
}
