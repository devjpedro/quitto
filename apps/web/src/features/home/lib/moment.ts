import type { Locale } from "@quitto/shared";
import { formatMoney, formatMonthName } from "@/lib/locale-format";
import { pluralForm } from "@/lib/plural";
import { m } from "@/paraglide/messages.js";
import type { Home } from "../types";
import type { MilestoneCell } from "./milestones";
import { onboardingView } from "./onboarding";

/** The one milestone worth showing right now. "guide" is not a strip cell: on a phone the guide itself is on the page. */
export type MomentMilestone =
  | Extract<
      MilestoneCell,
      { id: "all_clear" | "closest" | "paid" | "received" }
    >
  | { done: number; id: "guide"; total: number };

export interface MomentView {
  detail: string;
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
  const guide = onboardingView(home.onboarding);
  return guide.visible
    ? { id: "guide", done: guide.doneCount, total: guide.total }
    : null;
}

/** The lime card's two lines, in `locale`. Same messages as the strip, so both always agree. */
export function momentView(
  moment: MomentMilestone,
  locale: Locale
): MomentView {
  const options = { locale };
  switch (moment.id) {
    case "all_clear":
      return {
        title: m.home_milestone_all_clear(
          { month: formatMonthName(moment.month, locale) },
          options
        ),
        detail:
          pluralForm(moment.paidCount, locale) === "one"
            ? m.home_milestone_all_clear_detail_one({}, options)
            : m.home_milestone_all_clear_detail_other(
                { count: moment.paidCount },
                options
              ),
      };
    case "closest":
      return {
        title: m.home_milestone_closest({}, options),
        detail: m.home_milestone_closest_value(
          {
            title: moment.title,
            paid: moment.paidCount,
            total: moment.totalCount,
          },
          options
        ),
      };
    case "paid":
      return {
        title: m.home_milestone_paid(
          { month: formatMonthName(moment.month, locale) },
          options
        ),
        detail: formatMoney(moment.cents, locale),
      };
    case "received":
      return {
        title: m.home_milestone_received(
          { month: formatMonthName(moment.month, locale) },
          options
        ),
        detail: formatMoney(moment.cents, locale),
      };
    default:
      return {
        title: m.onboarding_tag({}, options),
        detail: m.onboarding_progress(
          { done: moment.done, total: moment.total },
          options
        ),
      };
  }
}
