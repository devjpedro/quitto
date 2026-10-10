import { INSTALLMENT_STATUS, isPaidStatus } from "@quitto/shared";
import {
  type Perspective,
  perspectiveOf,
} from "@/features/contracts/lib/contract-view";

export type PanelBlock =
  | "pix"
  | "no_pix"
  | "upload"
  | "registered"
  | "attach_later"
  | "mark_paid_link"
  | "charge"
  | "mark_received"
  | "proof_review"
  | "review_actions"
  | "receipt"
  | "proofs"
  | "dispute"
  | "reupload";

export type PanelPrimary =
  | "send_proof"
  | "whatsapp_charge"
  | "confirm"
  | "share_receipt"
  | "whatsapp_receipt"
  | "receipt_pdf";

export interface PanelInput {
  caps: { isApprover: boolean; isPayer: boolean };
  /** The other side has an account (a contact without one gets the receipt on WhatsApp, review I7). */
  counterpartHasAccount: boolean;
  hasProof: boolean;
  isOwner: boolean;
  perspective: Perspective;
  /** Paid when the contract was created: no proof was asked, one can still be attached. */
  registeredOnCreate?: boolean;
  requiresConfirmation: boolean;
  status: string;
}

export interface PanelView {
  blocks: PanelBlock[];
  /** The bottom sheet's pinned action; inline everywhere else. */
  primary: PanelPrimary | null;
}

function viewerPanel(status: string, hasProof: boolean): PanelView {
  if (status === INSTALLMENT_STATUS.awaitingConfirmation) {
    return { blocks: ["proof_review"], primary: null };
  }
  return {
    blocks: hasProof && status !== INSTALLMENT_STATUS.pending ? ["proofs"] : [],
    primary: null,
  };
}

/** A paid installment's main action: the owner shares the receipt, the others download it. */
function receiptPrimary(input: PanelInput): PanelPrimary {
  if (!input.isOwner) {
    return "receipt_pdf";
  }
  // The approved variant (ajuste 14 §2.4): whoever receives from a contact
  // with no account sends the receipt on WhatsApp.
  return input.perspective === "receive" && !input.counterpartHasAccount
    ? "whatsapp_receipt"
    : "share_receipt";
}

/** Paid when the contract was created: say so, and let the payer attach a proof later. */
function registeredPanel(input: PanelInput): PanelView {
  const attach = !input.hasProof && input.caps.isPayer;
  return {
    blocks: [
      "registered",
      ...(attach ? (["attach_later"] as const) : []),
      "receipt",
      ...(input.hasProof ? (["proofs"] as const) : []),
    ],
    primary: receiptPrimary(input),
  };
}

/**
 * What the panel shows for this role and state (spec §4.1; ajuste 14 §2.2:
 * no explanatory notes, only what there is to decide). One pure decision, so
 * the docked column, the floating panel and the bottom sheet always agree.
 */
export function panelView(input: PanelInput): PanelView {
  const { caps, hasProof, perspective, requiresConfirmation, status } = input;
  if (perspective === "view") {
    return viewerPanel(status, hasProof);
  }
  if (isPaidStatus(status) && input.registeredOnCreate) {
    return registeredPanel(input);
  }
  if (isPaidStatus(status)) {
    return {
      blocks: hasProof ? ["receipt", "proofs"] : ["receipt"],
      primary: receiptPrimary(input),
    };
  }
  const receives = perspective === "receive" && caps.isApprover;
  if (status === INSTALLMENT_STATUS.awaitingConfirmation) {
    // Whoever may approve reviews, even the owner who pays and inherits the
    // other side (the home offers "Conferir" too: canConfirm = isApprover), M3.
    return caps.isApprover
      ? { blocks: ["proof_review", "review_actions"], primary: "confirm" }
      : { blocks: ["proofs"], primary: null };
  }
  if (status === INSTALLMENT_STATUS.disputed) {
    return receives
      ? { blocks: ["dispute", "proofs", "mark_received"], primary: null }
      : { blocks: ["dispute", "proofs", "reupload"], primary: "send_proof" };
  }
  if (receives) {
    return { blocks: ["charge", "mark_received"], primary: "whatsapp_charge" };
  }
  return caps.isPayer
    ? {
        blocks: requiresConfirmation
          ? ["pix", "upload"]
          : ["pix", "upload", "mark_paid_link"],
        primary: "send_proof",
      }
    : { blocks: [], primary: null };
}

/**
 * The panel's input from the contract and the installment. The other side
 * is the payer to whoever receives and the receiver to whoever pays; with
 * nobody there, nobody gets a WhatsApp (counts as having an account).
 */
export function panelInputOf(
  contract: {
    contract: { requiresConfirmation: boolean };
    isApprover: boolean;
    isOwner: boolean;
    isPayer: boolean;
    participants: { linked: boolean; role: string }[];
    role: string;
  },
  installment: {
    proofs: unknown[];
    registeredOnCreate?: boolean;
    status: string;
  }
): PanelInput {
  const perspective = perspectiveOf(contract.role);
  const otherRole = perspective === "receive" ? "buyer" : "seller";
  const other = contract.participants.find((p) => p.role === otherRole);
  return {
    caps: { isApprover: contract.isApprover, isPayer: contract.isPayer },
    counterpartHasAccount: other ? other.linked : true,
    hasProof: installment.proofs.length > 0,
    isOwner: contract.isOwner,
    perspective,
    registeredOnCreate: installment.registeredOnCreate,
    requiresConfirmation: contract.contract.requiresConfirmation,
    status: installment.status,
  };
}
