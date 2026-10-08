import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { contractQueryOptions } from "@/features/contracts/api";
import { todayISO } from "@/lib/format";
import { getLocale } from "@/paraglide/runtime.js";
import { installmentQueryOptions, installmentsListQueryOptions } from "../api";
import { useInstallmentsRoute } from "../hooks/use-installments-route";
import {
  groupInstallments,
  type InstallmentGroup,
  isCurrentMonth,
} from "../lib/installment-groups";
import { monthOf, monthQuery } from "../lib/month-range";
import type { InstallmentListItem } from "../types";
import { InstallmentsAside } from "./installments-aside";
import { InstallmentsEmpty } from "./installments-empty";
import { InstallmentsHeader } from "./installments-header";
import { InstallmentsList } from "./installments-list";
import { InstallmentsToolbar } from "./installments-toolbar";

const route = getRouteApi("/_app/installments");

/** The arrows walk what is on screen: an open run shows its installments, a closed one none of them. */
function visibleItems(
  groups: InstallmentGroup[],
  expanded: ReadonlySet<string>
): InstallmentListItem[] {
  return groups.flatMap((group) =>
    group.lines.flatMap((line) =>
      line.items.length === 1 || expanded.has(line.id) ? line.items : []
    )
  );
}

/** The most urgent installment's contract: the first line of the first group that is not paid. */
function urgentContract(groups: InstallmentGroup[]): string | null {
  const group = groups.find((g) => g.id !== "paid");
  return group?.items[0]?.contractId ?? null;
}

/**
 * Parcelas once the month is here: the title and switch, the month and the
 * chips, the groups, and the aside (the docked panel or the urgent card).
 * Reads the month unfiltered and filters on screen, so a chip answers at once.
 */
export function InstallmentsContent() {
  const queryClient = useQueryClient();
  const locale = getLocale();
  const clock = todayISO();
  const urlSearch = route.useSearch();
  const month = urlSearch.month ?? monthOf(clock);
  const { data } = useSuspenseQuery(
    installmentsListQueryOptions(monthQuery(month, clock))
  );
  const today = data.today;
  const { counts, groups } = groupInstallments(data.items, {
    filter: urlSearch.filter,
    month,
    today,
  });
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggle = useCallback((lineId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(lineId)) {
        next.add(lineId);
      }
      return next;
    });
  }, []);
  const visible = visibleItems(groups, expanded);
  const { openWithContract, panel, search, setFilter, setMonth } =
    useInstallmentsRoute(visible, today);
  const prefetch = useCallback(
    (item: InstallmentListItem) => {
      queryClient.prefetchQuery(contractQueryOptions(item.contractId));
      queryClient.prefetchQuery(installmentQueryOptions(item.installmentId));
    },
    [queryClient]
  );
  return (
    <div className="lateral:grid lateral:grid-cols-[minmax(0,1fr)_420px] lateral:gap-x-7">
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">
        <InstallmentsHeader />
        <InstallmentsToolbar
          counts={counts}
          current={isCurrentMonth(month, today)}
          filter={search.filter}
          locale={locale}
          month={month}
          onFilter={setFilter}
          onMonth={setMonth}
        />
        {groups.length === 0 ? (
          <InstallmentsEmpty
            filtered={search.filter !== undefined}
            hasContracts={data.hasContracts}
            locale={locale}
            month={month}
            onClearFilter={() => setFilter(undefined)}
            onMonth={setMonth}
          />
        ) : (
          <InstallmentsList
            expanded={expanded}
            groups={groups}
            locale={locale}
            month={month}
            onIntent={prefetch}
            onOpen={panel.openInstallment}
            onToggle={toggle}
            selectedId={panel.installmentId}
            today={today}
          />
        )}
      </div>
      <InstallmentsAside
        contractId={search.contract}
        onOpenWithContract={openWithContract}
        panel={panel}
        urgentContractId={urgentContract(groups)}
      />
    </div>
  );
}
