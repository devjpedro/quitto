import { INSTALLMENT_STATUS, type InstallmentStatus } from "@quitto/shared";
import { ValidationError } from "./errors";

export type { InstallmentStatus } from "@quitto/shared";

export type InstallmentAction =
  | "submit_proof"
  | "confirm"
  | "dispute"
  | "mark_paid";

/**
 * Pure transition function. `requiresConfirmation` selects the ruleset.
 * Throws ValidationError for illegal transitions.
 */
export function nextStatus(
  current: InstallmentStatus,
  action: InstallmentAction,
  requiresConfirmation: boolean
): InstallmentStatus {
  if (requiresConfirmation) {
    if (
      action === "submit_proof" &&
      (current === INSTALLMENT_STATUS.pending ||
        current === INSTALLMENT_STATUS.disputed)
    ) {
      return INSTALLMENT_STATUS.awaitingConfirmation;
    }
    if (
      action === "confirm" &&
      current === INSTALLMENT_STATUS.awaitingConfirmation
    ) {
      return INSTALLMENT_STATUS.confirmed;
    }
    if (
      action === "dispute" &&
      current === INSTALLMENT_STATUS.awaitingConfirmation
    ) {
      return INSTALLMENT_STATUS.disputed;
    }
  } else if (
    (action === "submit_proof" || action === "mark_paid") &&
    current !== INSTALLMENT_STATUS.paid
  ) {
    return INSTALLMENT_STATUS.paid;
  }
  throw new ValidationError(
    `Transição inválida: ${current} + ${action} (confirmação=${requiresConfirmation})`
  );
}
