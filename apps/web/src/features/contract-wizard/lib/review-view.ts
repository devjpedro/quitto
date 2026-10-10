import type { Locale } from "@quitto/shared";
import type { PreviewModel } from "@/components/preview/types";
import { formatDate, formatMoney } from "@/lib/locale-format";
import { summaryText } from "@/lib/schedule-summary";
import { m } from "@/paraglide/messages.js";
import { confirmTitle } from "./confirm-title";
import { rowsOf, type WizardValues } from "./wizard-values";

export interface ReviewView {
  aboutDetail?: string;
  aboutLine: string;
  /** Beside the preview (≥ 1140): "Você confirma cada pagamento", or null. */
  confirmLine: string | null;
  /** Beside the preview (≥ 1140): "Convite para …", or null. */
  inviteLine: string | null;
  partyDetail?: string;
  partyLine: string;
  /** The other party's name (a face), or null for "Só você acompanha". */
  partyName: string | null;
  scheduleDetail?: string;
  scheduleLine: string;
}

function datesOf(
  preview: PreviewModel,
  first: string | undefined,
  locale: Locale
): string | undefined {
  const last = preview.lastDueDate;
  if (!(first && last)) {
    return;
  }
  const range = {
    first: formatDate(first, locale, "short"),
    last: formatDate(last, locale, "short"),
  };
  const day =
    preview.summary && preview.summary.kind !== "varied"
      ? preview.summary.day
      : null;
  return day === null
    ? m.wizard_review_dates(range)
    : m.wizard_review_dates_day({ ...range, day });
}

/** "R$ 6.000,00 em 12x de R$ 500,00"; varied amounts already say the total ("3 parcelas · R$ 6.000,00 no total"). */
function scheduleLineOf(preview: PreviewModel, locale: Locale): string {
  if (!preview.summary || preview.totalCents === null) {
    return "";
  }
  const total = formatMoney(preview.totalCents, locale);
  if (preview.summary.kind === "varied") {
    return m.home_invite_terms_total({
      count: preview.summary.count,
      amount: total,
    });
  }
  return m.wizard_review_schedule({
    total,
    summary: summaryText(preview.summary, locale, "every").strong,
  });
}

function paidLine(count: number): string {
  return count === 1
    ? m.wizard_review_paid_one()
    : m.wizard_review_paid_other({ count });
}

/** Step 4's lines (mockup 15, D4): the whole review below 1140, the two extras beside the preview. */
export function reviewView(
  values: WizardValues,
  preview: PreviewModel,
  locale: Locale
): ReviewView {
  const paidText = preview.paidCount === 0 ? "" : paidLine(preview.paidCount);
  const receives = values.ownerRole === "seller";
  const withParty = values.party === "other";
  const name = values.counterpartyName.trim();
  const firstName = name.split(" ")[0] || null;
  const email = withParty ? values.counterpartyEmail.trim() : "";
  const confirms = withParty && values.requiresConfirmation;
  const side = receives ? m.preview_side_receive() : m.preview_side_pay();
  const confirmShort = receives
    ? m.wizard_review_confirm_mine_line()
    : confirmTitle(false, firstName);
  const confirmFull = receives
    ? m.wizard_review_confirm_mine()
    : confirmTitle(false, firstName);
  const partyDetail = [
    email
      ? m.wizard_review_invite_line({ email })
      : m.wizard_review_no_invite(),
    ...(confirms ? [confirmShort] : []),
  ].join(" · ");
  return {
    aboutLine: `${side} ${m.home_dot_after({ text: values.title.trim() })}`,
    aboutDetail: values.description.trim() || undefined,
    scheduleLine: scheduleLineOf(preview, locale),
    scheduleDetail:
      [paidText, datesOf(preview, rowsOf(values)[0]?.dueDate, locale)]
        .filter(Boolean)
        .join(" · ") || undefined,
    partyName: withParty && name ? name : null,
    partyLine: withParty && name ? name : m.preview_person_solo(),
    partyDetail: withParty ? partyDetail : undefined,
    inviteLine: email ? m.wizard_review_invite({ email }) : null,
    confirmLine: confirms ? confirmFull : null,
  };
}
