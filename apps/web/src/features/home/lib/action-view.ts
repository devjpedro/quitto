import type { Locale } from "@quitto/shared";
import type { TagTone } from "@/components/ui/tag";
import { formatDate, formatRelativeDays } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import type { HomeAction, InstallmentAction } from "../types";

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
  | "decline";

/** Buttons that open the installment in its contract (the legacy drawer until Fase 2). */
export const LINK_BUTTONS: ReadonlySet<ActionButtonKind> =
  new Set<ActionButtonKind>(["pix", "send_proof", "review", "resend_proof"]);

export interface ActionView {
  detail: string | null;
  meta: string;
  tag: string;
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

interface KindTag {
  long: string;
  short: string;
  tone: TagTone;
}

function kindTag(
  action: InstallmentAction,
  when: string,
  locale: Locale
): KindTag {
  const options = { locale };
  switch (action.kind) {
    case "overdue":
      return {
        tone: "danger",
        long: m.home_tag_overdue({ when }, options),
        short: m.home_first_overdue({}, options),
      };
    case "review":
      return {
        tone: "warning",
        long: m.home_tag_review({}, options),
        short: m.home_first_review({}, options),
      };
    case "disputed":
      return {
        tone: "danger",
        long: m.home_tag_disputed({}, options),
        short: m.home_first_disputed({}, options),
      };
    default:
      return {
        tone: "neutral",
        long: m.home_tag_due({ when }, options),
        short: when,
      };
  }
}

function counterpartyLine(action: InstallmentAction, locale: Locale): string {
  const options = { locale };
  if (action.kind === "review") {
    return m.home_detail_review({}, options);
  }
  if (action.kind === "disputed") {
    return m.home_detail_disputed({}, options);
  }
  const name = action.counterpartyName;
  if (!name) {
    return m.home_detail_due_on(
      { date: formatDate(action.dueDate, locale, "dayMonth") },
      options
    );
  }
  return action.direction === "pay"
    ? m.home_detail_pay_to({ name }, options)
    : m.home_detail_owes_you({ name }, options);
}

/** Text of an action card, all in `locale`: the tag and its tone, the line above the amount, the line below it. */
export function describeAction(
  action: HomeAction,
  { first, locale, today }: { first: boolean; locale: Locale; today: string }
): ActionView {
  const options = { locale };
  if (action.kind === "invite") {
    const role = (ROLE_NAME[action.role] ?? m.home_role_viewer)({}, options);
    return {
      tone: first ? "highlight" : "brand",
      tag: first
        ? m.home_tag_first({ label: m.home_first_invite({}, options) }, options)
        : m.home_tag_invite({}, options),
      meta: m.home_detail_invite({ name: action.inviterName, role }, options),
      detail: null,
    };
  }
  const tag = kindTag(
    action,
    formatRelativeDays(action.dueDate, today, locale),
    locale
  );
  return {
    tone: first ? "highlight" : tag.tone,
    tag: first ? m.home_tag_first({ label: tag.short }, options) : tag.long,
    meta: m.home_card_meta(
      {
        title: action.contractTitle,
        sequence: action.sequence,
        count: action.installmentsCount,
      },
      options
    ),
    detail: counterpartyLine(action, locale),
  };
}

function payButtons(action: InstallmentAction): ActionButtonKind[] {
  if (action.canMarkPaid) {
    return action.pixCode ? ["pix", "mark_paid"] : ["mark_paid"];
  }
  // With confirmation the payment needs a proof, and the installment drawer has the upload.
  return action.pixCode ? ["pix"] : ["send_proof"];
}

/** A card's direct actions, primary first (at most two). */
export function actionButtons(action: HomeAction): ActionButtonKind[] {
  switch (action.kind) {
    case "invite":
      return ["accept", "decline"];
    case "review":
      return action.canConfirm ? ["review", "confirm"] : ["review"];
    case "disputed":
      return ["resend_proof"];
    default:
      if (action.direction === "pay") {
        return payButtons(action);
      }
      return action.canMarkPaid ? ["whatsapp", "mark_received"] : ["whatsapp"];
  }
}
