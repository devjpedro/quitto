import { CaretRight } from "@phosphor-icons/react";
import { SectionTitle } from "@/components/ui/section-title";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { ContractRoute } from "../hooks/use-contract-route";
import { groupEvents } from "../lib/contract-events";
import type { ContractDetail } from "../types";
import { EventRow } from "./event-row";

const LINES = 3;

/**
 * "Atividade recente" in the side column (mockup 14): the three latest lines
 * from every day in one block, with when each happened, and "Ver histórico"
 * to switch the tab. Not drawn without events.
 */
export function RecentActivity({
  detail,
  route,
}: {
  detail: ContractDetail;
  route: ContractRoute;
}) {
  const lines = groupEvents(detail.recentEvents, {
    today: route.today,
    locale: getLocale(),
  })
    .flatMap((day) => day.rows)
    .slice(0, LINES);
  if (lines.length === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby="recent-activity-title"
      data-testid="recent-activity"
    >
      <SectionTitle
        aux={
          <button
            className="inline-flex min-h-11 items-center gap-0.5 rounded-control px-1 text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:min-h-0"
            onClick={() => route.setTab("history")}
            type="button"
          >
            {m.history_see_all()}
            <CaretRight aria-hidden="true" size={13} />
          </button>
        }
        id="recent-activity-title"
      >
        {m.history_title()}
      </SectionTitle>
      <ul className="divide-y divide-divider overflow-hidden rounded-card bg-surface-card">
        {lines.map((line) => (
          <EventRow key={line.key} line={line} showWhen />
        ))}
      </ul>
    </section>
  );
}
