import type { Locale } from "@quitto/shared";
import type { TagTone } from "@/components/ui/tag";
import { inviteTerms } from "@/lib/invite-terms-text";
import { sequencesLabel } from "@/lib/sequences-label";
import { m } from "@/paraglide/messages.js";
import type { HomeAction, InstallmentAction } from "../types";
import { kindTag, legendOf, type PersonLine, personLine } from "./action-text";

export type { PersonLine } from "./action-text";

export type ActionButtonKind =
  | "pix"
  | "mark_paid"
  | "send_proof"
  | "whatsapp"
  | "mark_received"
  | "review"
  | "confirm"
  | "resend_proof"
  | "accept"
  | "decline"
  | "pay_oldest"
  | "see_installments";

/** Buttons that open the installment in its contract: on a group, the oldest one. */
export const LINK_BUTTONS: ReadonlySet<ActionButtonKind> =
  new Set<ActionButtonKind>([
    "pix",
    "send_proof",
    "review",
    "resend_proof",
    "pay_oldest",
  ]);

export interface ActionView {
  /** The card's amount: the group's total, or the installment's; null on an invite. */
  amountCents: number | null;
  /**
   * Installment cards: "4 de 12 pagas" and "falta R$ 14.400,00", under the
   * bar. Null (no bar either) on a card whose contract a card above already
   * shows: once per screen.
   */
  legend: { done: string; remaining: string } | null;
  person: PersonLine | null;
  /** "parcela 5 de 12" / "parcelas 3 e 4 de 12"; null on an invite. */
  sequence: string | null;
  tag: string;
  /** Invite only: "4 parcelas de R$ 300,00" and "a partir de 10/11". */
  terms: { amount: string; from: string | null } | null;
  /** The contract's title: with `sequence`, the card's accessible name. */
  title: string;
  tone: TagTone;
}

/** A parameterless Paraglide message, called in an explicit locale. */
type Message = (
  inputs: Record<string, never>,
  options: { locale: Locale }
) => string;

const ROLE_NAME: Record<string, Message> = {
  buyer: m.home_role_buyer,
  seller: m.home_role_seller,
  viewer: m.home_role_viewer,
};

/** Everything a card says, in `locale`. */
export function describeAction(
  action: HomeAction,
  {
    first,
    locale,
    sameContractBefore = false,
    today,
  }: {
    first: boolean;
    locale: Locale;
    /** A card above is of the same contract, and already shows its bar. */
    sameContractBefore?: boolean;
    today: string;
  }
): ActionView {
  const options = { locale };
  if (action.kind === "invite") {
    const role = (ROLE_NAME[action.role] ?? m.home_role_viewer)({}, options);
    return {
      tone: first ? "highlight" : "brand",
      tag: first
        ? m.home_tag_first({ label: m.home_first_invite({}, options) }, options)
        : m.home_tag_invite({}, options),
      title: action.contractTitle,
      sequence: null,
      amountCents: null,
      person: {
        name: action.inviterName,
        text: m.home_detail_invite({ name: action.inviterName, role }, options),
      },
      terms: inviteTerms(action, today, locale),
      legend: null,
    };
  }
  const tag = kindTag(action, today, locale);
  return {
    tone: first ? "highlight" : tag.tone,
    tag: first ? m.home_tag_first({ label: tag.short }, options) : tag.long,
    title: action.contractTitle,
    sequence: sequencesLabel(
      action.sequences,
      action.installmentsCount,
      locale
    ),
    amountCents: action.totalCents,
    person: personLine(action, today, locale),
    terms: null,
    legend: sameContractBefore ? null : legendOf(action, locale),
  };
}

/** Per card, whether a card above is of the same contract (invites have none of their own). */
export function sameContractBefore(actions: HomeAction[]): boolean[] {
  const seen = new Set<string>();
  return actions.map((action) => {
    if (action.kind === "invite") {
      return false;
    }
    const repeat = seen.has(action.contractId);
    seen.add(action.contractId);
    return repeat;
  });
}

function payButtons(action: InstallmentAction): ActionButtonKind[] {
  if (action.canMarkPaid) {
    return action.pixCode ? ["pix", "mark_paid"] : ["mark_paid"];
  }
  // With confirmation the payment needs a proof, and the installment drawer has the upload.
  return action.pixCode ? ["pix"] : ["send_proof"];
}

/**
 * A card's direct actions, primary first (at most two). A group of overdue
 * installments only has links (owner's decision 6): no optimistic "Já paguei"
 * over many installments at once.
 */
export function actionButtons(action: HomeAction): ActionButtonKind[] {
  switch (action.kind) {
    case "invite":
      return ["accept", "decline"];
    case "review":
      return action.canConfirm ? ["review", "confirm"] : ["review"];
    case "disputed":
      return ["resend_proof"];
    default:
      if (action.count > 1) {
        return action.direction === "pay"
          ? ["pay_oldest", "see_installments"]
          : ["whatsapp", "see_installments"];
      }
      if (action.direction === "pay") {
        return payButtons(action);
      }
      return action.canMarkReceived
        ? ["whatsapp", "mark_received"]
        : ["whatsapp"];
  }
}
