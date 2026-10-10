import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { contractEventsQueryOptions } from "../api";
import type { ContractRoute } from "../hooks/use-contract-route";
import { groupEvents } from "../lib/contract-events";
import { EventRow } from "./event-row";

const DAYS = ["d1", "d2"];
const ROWS = ["r1", "r2", "r3"];

function HistorySkeleton() {
  return (
    <div aria-hidden="true">
      {DAYS.map((day) => (
        <div className="mt-4.5 first:mt-0" key={day}>
          <Skeleton className="mb-2 h-4 w-48 bg-surface-card" />
          <div className="divide-y divide-divider overflow-hidden rounded-card bg-surface-card">
            {ROWS.map((row) => (
              <div
                className="flex h-[58px] items-center gap-3.5 pl-3"
                key={row}
              >
                <Skeleton className="size-10 shrink-0 bg-surface-inset" />
                <Skeleton className="h-4 w-56 max-w-[60%] bg-surface-inset" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryDays({ route }: { route: ContractRoute }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery(contractEventsQueryOptions(route.id));
  // A null page: the contract is gone, and the page itself says so.
  const events = data.pages.flatMap((page) => page?.items ?? []);
  const days = groupEvents(events, {
    today: route.today,
    locale: getLocale(),
  });
  return (
    <div data-testid="history">
      {days.map((day) => (
        <section className="mt-4.5 first:mt-0" key={day.key}>
          <p className="mb-2 font-medium text-[12.5px] text-ink-muted">
            {day.label}
          </p>
          <ul className="divide-y divide-divider overflow-hidden rounded-card bg-surface-card">
            {day.rows.map((line) => (
              <EventRow key={line.key} line={line} />
            ))}
          </ul>
        </section>
      ))}
      {hasNextPage ? (
        <div className="mt-3 flex justify-center">
          <Button
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
            size="sm"
            variant="ghost"
          >
            {m.history_more()}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** The Histórico tab (mockup 14, F2): one filled block per day, newest first. */
export function HistoryTab({ route }: { route: ContractRoute }) {
  return (
    <SectionBoundary fallback={<HistorySkeleton />}>
      <HistoryDays route={route} />
    </SectionBoundary>
  );
}
