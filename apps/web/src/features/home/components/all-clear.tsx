import { Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { formatMoney, formatRelativeDays } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { UpcomingItem } from "../types";
import { UPCOMING_SECTION_ID } from "./upcoming-list";

/**
 * Same-page jump: no fragment in the URL, so the router neither reloads nor
 * restores scroll. The focus goes along, so the next Tab and the screen
 * reader continue from the list.
 */
function jumpToUpcoming() {
  const section = document.getElementById(UPCOMING_SECTION_ID);
  section?.scrollIntoView({ block: "start" });
  section?.focus({ preventScroll: true });
}

/** "Agora" with nothing pending: says so and names the next installment. Milestones and the next 30 days still follow. */
export function AllClear({
  hasUpcoming,
  nextDue,
  today,
}: {
  hasUpcoming: boolean;
  nextDue: UpcomingItem | null;
  today: string;
}) {
  const locale = getLocale();
  const text = nextDue
    ? m.home_all_clear_next({
        title: nextDue.contractTitle,
        when: formatRelativeDays(nextDue.dueDate, today, locale),
        amount: formatMoney(nextDue.amountCents, locale),
      })
    : m.home_all_clear_none();
  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-card bg-highlight p-4 text-on-highlight">
      <span
        aria-hidden="true"
        className="relative flex size-11 shrink-0 items-center justify-center"
      >
        <ProgressRing
          className="absolute inset-0 size-11"
          percent={100}
          size={44}
          tone="onHighlight"
        />
        <Check size={20} weight="bold" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display font-semibold text-lg tracking-[-0.02em]">
          {m.home_all_clear_title()}
        </p>
        <p className="text-sm">{text}</p>
      </div>
      {hasUpcoming ? (
        // A row of its own on a phone: next to the text it would squeeze it to ~80 px.
        <Button
          className="w-full md:w-auto"
          onClick={jumpToUpcoming}
          size="sm"
          variant="onBrand"
        >
          {m.home_all_clear_cta()}
        </Button>
      ) : null}
    </div>
  );
}
