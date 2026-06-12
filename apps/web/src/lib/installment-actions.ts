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
  const isPayer = role === "owner" || role === "buyer";
  const isApprover = role === "owner" || role === "seller";
  const awaiting = requiresConfirmation && status === "awaiting_confirmation";
  return {
    canUpload: isPayer && (status === "pending" || status === "disputed"),
    canMarkPaid: isPayer && !requiresConfirmation && status === "pending",
    canConfirm: isApprover && awaiting,
    canDispute: isApprover && awaiting,
  };
}
