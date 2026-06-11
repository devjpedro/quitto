import { ValidationError } from "./errors";

export type InstallmentStatus =
  | "pending"
  | "awaiting_confirmation"
  | "confirmed"
  | "disputed"
  | "paid";

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
      (current === "pending" || current === "disputed")
    ) {
      return "awaiting_confirmation";
    }
    if (action === "confirm" && current === "awaiting_confirmation") {
      return "confirmed";
    }
    if (action === "dispute" && current === "awaiting_confirmation") {
      return "disputed";
    }
  } else if (
    (action === "submit_proof" || action === "mark_paid") &&
    current !== "paid"
  ) {
    return "paid";
  }
  throw new ValidationError(
    `Transição inválida: ${current} + ${action} (confirmação=${requiresConfirmation})`
  );
}
