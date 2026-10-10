import type { Locale } from "@quitto/shared";
import { sinceDate } from "@/lib/date-parts";
import { formatDate, formatMoney, formatMonthName } from "@/lib/locale-format";
import { pluralForm } from "@/lib/plural";
import { m } from "@/paraglide/messages.js";
import type { Home } from "../types";
import type { MomentMilestoneCell } from "./milestones";
import { guideContext, onboardingView } from "./onboarding";

/** The one milestone worth showing right now. "guide" is not a strip cell: on a phone the guide itself is on the page. */
export type MomentMilestone =
  | MomentMilestoneCell
  | { done: number; id: "guide"; total: number };

export interface MomentView {
  /** A third line when there is one: "Falta 1 parcela, em 13/10". */
  detail: string | null;
  /** What kind of milestone: "Mais perto de quitar", "Tudo em dia em setembro". */
  label: string;
  /** The ring's % when the milestone is progress (DIRECAO › Progresso); null when it is not. */
  percent: number | null;
  /** The milestone itself: "Celular da Ana · 9/10", "12 de 12 parcelas quitadas", "R$ 2.300,00". */
  title: string;
}

/**
 * The milestone of the moment: the lime card at the foot of the sidebar on
 * desktop (mockups 02 and 08) and the first cell of the strip on a phone.
 * Priority: all paid on time last month > closest to payoff > paid this month
 * > received this month > the guide's progress. null when there is none.
 */
export function momentMilestone(home: Home): MomentMilestone | null {
  const ms = home.milestones;
  if (ms.previousMonthAllClear) {
    return { id: "all_clear", ...ms.previousMonthAllClear };
  }
  if (ms.closestToPayoff) {
    return { id: "closest", ...ms.closestToPayoff };
  }
  const { month, paidCents, receivedCents } = ms.monthToDate;
  if (paidCents > 0) {
    return { id: "paid", month, cents: paidCents };
  }
  if (receivedCents > 0) {
    return { id: "received", month, cents: receivedCents };
  }
  const guide = onboardingView(home.onboarding, guideContext(home));
  return guide.visible
    ? { id: "guide", done: guide.doneCount, total: guide.total }
    : null;
}

/**
 * "Falta 1 parcela, em 13/10"; with no date yet, "Falta 1 parcela"; "Faltam N
 * parcelas" otherwise. The date is the oldest open installment's: once it is
 * past, the line says since when it is late, never "em" a date gone by.
 */
function remainingDetail(
  remainingCount: number,
  nextDueDate: string | null,
  today: string,
  locale: Locale
): string {
  const options = { locale };
  if (nextDueDate && nextDueDate < today) {
    const date = sinceDate(nextDueDate, today, locale);
    return remainingCount === 1
      ? m.home_moment_one_left_overdue({ date }, options)
      : m.home_moment_many_left_overdue(
          { count: remainingCount, date },
          options
        );
  }
  if (remainingCount !== 1) {
    return m.home_moment_many_left({ count: remainingCount }, options);
  }
  if (nextDueDate) {
    return m.home_moment_one_left(
      { date: formatDate(nextDueDate, locale, "dayMonth") },
      options
    );
  }
  return m.home_moment_one_left_nodate({}, options);
}

/**
 * The lime card's text, in `locale`; `today` (the home's, São Paulo) tells a
 * late installment from one still ahead. The strip's cells read their text
 * from here too, so both always agree. On a phone the lime cell is short
 * (variant "phone"): "Mais perto de quitar · 67%" and just the contract's name.
 */
export function momentView(
  moment: MomentMilestone,
  locale: Locale,
  today: string,
  variant: "card" | "phone" = "card"
): MomentView {
  const options = { locale };
  switch (moment.id) {
    case "all_clear":
      return {
        label: m.home_milestone_all_clear(
          { month: formatMonthName(moment.month, locale) },
          options
        ),
        title:
          pluralForm(moment.paidCount, locale) === "one"
            ? m.home_milestone_all_clear_detail_one({}, options)
            : m.home_milestone_all_clear_detail_other(
                { count: moment.paidCount },
                options
              ),
        detail: null,
        percent: 100,
      };
    case "closest":
      if (variant === "phone") {
        return {
          label: m.home_moment_phone_label(
            { percent: moment.percent },
            options
          ),
          title: moment.title,
          detail: null,
          percent: moment.percent,
        };
      }
      return {
        label: m.home_milestone_closest({}, options),
        title: m.home_milestone_closest_value(
          {
            title: moment.title,
            paid: moment.paidCount,
            total: moment.totalCount,
          },
          options
        ),
        detail: remainingDetail(
          moment.remainingCount,
          moment.nextDueDate,
          today,
          locale
        ),
        percent: moment.percent,
      };
    case "paid":
      return {
        label: m.home_milestone_paid(
          { month: formatMonthName(moment.month, locale) },
          options
        ),
        title: formatMoney(moment.cents, locale),
        detail: null,
        percent: null,
      };
    case "received":
      return {
        label: m.home_milestone_received(
          { month: formatMonthName(moment.month, locale) },
          options
        ),
        title: formatMoney(moment.cents, locale),
        detail: null,
        percent: null,
      };
    default:
      return {
        label: m.onboarding_tag({}, options),
        title: m.onboarding_progress(
          { done: moment.done, total: moment.total },
          options
        ),
        detail: null,
        percent: Math.round((moment.done / moment.total) * 100),
      };
  }
}
