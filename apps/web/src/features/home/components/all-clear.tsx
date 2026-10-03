import { CheckCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { formatMoney, formatRelativeDays } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { UpcomingItem } from "../types";

/** Same-page jump: no fragment in the URL, so the router neither reloads nor restores scroll. */
function scrollToUpcoming() {
  document.getElementById("upcoming")?.scrollIntoView({ block: "start" });
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
    <div className="flex flex-wrap items-center gap-3.5 rounded-card border border-line bg-surface-raised p-4">
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-control bg-brand-subtle text-brand"
      >
        <CheckCircle size={22} weight="fill" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display font-semibold text-lg tracking-[-0.02em]">
          {m.home_all_clear_title()}
        </p>
        <p className="text-ink-muted text-sm">{text}</p>
      </div>
      {hasUpcoming ? (
        // A row of its own on a phone: next to the text it would squeeze it to ~80 px.
        <Button
          className="w-full md:w-auto"
          onClick={scrollToUpcoming}
          size="sm"
          variant="secondary"
        >
          {m.home_all_clear_cta()}
        </Button>
      ) : null}
    </div>
  );
}
