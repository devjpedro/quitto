import type { Locale } from "@quitto/shared";
import type { TagTone } from "@/components/ui/tag";
import { sinceDate } from "@/lib/date-parts";
import {
  formatDate,
  formatMoney,
  formatRelativeDays,
} from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import type { InstallmentAction } from "../types";

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
        // The count only: "desde" the oldest is on the person's line, once
        // per screen.
        return {
          tone: "danger",
          long: m.home_tag_overdue_many({ count: action.count }, options),
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

/** "4 pagas" (or "recebidas") and "falta R$ 14.400,00": the whole contract, under its bar. */
export function legendOf(action: InstallmentAction, locale: Locale) {
  const options = { locale };
  const paid = action.contract.paidCount;
  return {
    done:
      action.direction === "pay"
        ? m.home_progress_paid({ paid }, options)
        : m.home_progress_received({ paid }, options),
    remaining: m.home_progress_remaining(
      { amount: formatMoney(action.contract.remainingCents, locale) },
      options
    ),
  };
}
