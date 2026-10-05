import type { Locale } from "@quitto/shared";
import type { TagTone } from "@/components/ui/tag";
import {
  formatDate,
  formatMoney,
  formatRelativeDays,
} from "@/lib/locale-format";
import { pluralForm } from "@/lib/plural";
import { m } from "@/paraglide/messages.js";
import type { InstallmentAction, InviteAction } from "../types";

export interface KindTag {
  long: string;
  short: string;
  tone: TagTone;
}

/** The other party's line on a card; `name`, when there is one, is shown in bold beside the avatar. */
export interface PersonLine {
  name: string | null;
  text: string;
}

/** "30/08", or "28/10/2024" when it is another year. */
export function sinceDate(iso: string, today: string, locale: Locale): string {
  return iso.slice(0, 4) === today.slice(0, 4)
    ? formatDate(iso, locale, "dayMonth")
    : formatDate(iso, locale, "short");
}

export function kindTag(
  action: InstallmentAction,
  today: string,
  locale: Locale
): KindTag {
  const options = { locale };
  const when = formatRelativeDays(action.dueDate, today, locale);
  switch (action.kind) {
    case "overdue":
      if (action.count > 1) {
        return {
          tone: "danger",
          long: m.home_tag_overdue_many(
            {
              count: action.count,
              date: sinceDate(action.dueDate, today, locale),
            },
            options
          ),
          short: m.home_first_overdue_many({ count: action.count }, options),
        };
      }
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
        // Due today is black, the color of action (mockup 13).
        tone: action.dueDate === today ? "ink" : "neutral",
        long: m.home_tag_due({ when }, options),
        short: when,
      };
  }
}

export function personLine(
  action: InstallmentAction,
  today: string,
  locale: Locale
): PersonLine {
  const options = { locale };
  const name = action.counterpartyName;
  if (action.kind === "review") {
    return name
      ? { name, text: m.home_detail_review_from({ name }, options) }
      : { name: null, text: m.home_detail_review({}, options) };
  }
  if (action.kind === "disputed") {
    return name
      ? { name, text: m.home_detail_disputed_by({ name }, options) }
      : { name: null, text: m.home_detail_disputed({}, options) };
  }
  const date = sinceDate(action.dueDate, today, locale);
  if (!name) {
    // No one to name (the owner alone in the contract). An overdue card, one
    // installment or a group, is late: say since when, never "Vence em" a
    // date that is already past.
    return {
      name: null,
      text:
        action.kind === "overdue"
          ? m.home_detail_overdue_since({ date }, options)
          : m.home_detail_due_on(
              { date: formatDate(action.dueDate, locale, "dayMonth") },
              options
            ),
    };
  }
  const group = action.count > 1;
  if (action.direction === "pay") {
    return {
      name,
      text: group
        ? m.home_detail_pay_to_since({ name, date }, options)
        : m.home_detail_pay_to({ name }, options),
    };
  }
  return {
    name,
    text: group
      ? m.home_detail_owes_you_since({ name, date }, options)
      : m.home_detail_owes_you({ name }, options),
  };
}

/** "4 de 12 pagas" (or "recebidas") and "falta R$ 14.400,00": the whole contract, under its bar. */
export function legendOf(action: InstallmentAction, locale: Locale) {
  const options = { locale };
  const paid = action.contract.paidCount;
  const total = action.installmentsCount;
  return {
    done:
      action.direction === "pay"
        ? m.home_progress_paid({ paid, total }, options)
        : m.home_progress_received({ paid, total }, options),
    remaining: m.home_progress_remaining(
      { amount: formatMoney(action.contract.remainingCents, locale) },
      options
    ),
  };
}

/** "4 parcelas de R$ 300,00 · a partir de 10/11" (owner's decision 5), with the year when it is another one; the total when the amounts differ. */
export function inviteTerms(
  action: InviteAction,
  today: string,
  locale: Locale
) {
  const options = { locale };
  const count = action.installmentsCount;
  let amount: string;
  if (action.amountCents === null) {
    amount = m.home_invite_terms_total(
      { count, amount: formatMoney(action.totalCents, locale) },
      options
    );
  } else {
    const each = formatMoney(action.amountCents, locale);
    amount =
      pluralForm(count, locale) === "one"
        ? m.home_invite_terms_each_one({ amount: each }, options)
        : m.home_invite_terms_each_other({ count, amount: each }, options);
  }
  return {
    amount,
    from: action.firstDueDate
      ? m.home_invite_terms_from(
          { date: sinceDate(action.firstDueDate, today, locale) },
          options
        )
      : null,
  };
}
