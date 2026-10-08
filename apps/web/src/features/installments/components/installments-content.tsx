import { isPaidStatus } from "@quitto/shared";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { type ReactNode, useCallback, useMemo } from "react";
import { contractQueryOptions } from "@/features/contracts/api";
import { LATERAL_UP, useMediaQuery } from "@/hooks/use-media-query";
import { todayISO } from "@/lib/format";
import { getLocale } from "@/paraglide/runtime.js";
import { installmentQueryOptions, installmentsListQueryOptions } from "../api";
import { useInstallmentsRoute } from "../hooks/use-installments-route";
import { calendarMonth, defaultDay } from "../lib/calendar-month";
import {
  filterItems,
  groupInstallments,
  type InstallmentGroup,
  isCurrentMonth,
} from "../lib/installment-groups";
import { monthOf, monthQuery } from "../lib/month-range";
import type { InstallmentListItem } from "../types";
import { InstallmentsAside } from "./installments-aside";
import { InstallmentsCalendar } from "./installments-calendar";
import { InstallmentsEmpty } from "./installments-empty";
import { InstallmentsHeader } from "./installments-header";
import { InstallmentsList } from "./installments-list";
import { InstallmentsToolbar } from "./installments-toolbar";

const route = getRouteApi("/_app/installments");

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
  const calendar = urlSearch.view === "calendar";
  const wide = useMediaQuery(LATERAL_UP, false);
  const gridItems = useMemo(
    () => filterItems(data.items, urlSearch.filter, today),
    [data.items, urlSearch.filter, today]
  );
  const day = urlSearch.day ?? defaultDay(month, today, gridItems);
  const monthFrom = `${month}-01`;
  const carried = gridItems.filter(
    (item) => item.dueDate < monthFrom && !isPaidStatus(item.status)
  ).length;
  let visible = groups.flatMap((group) => group.items);
  if (calendar) {
    const cells = calendarMonth(month, gridItems, today).flat();
    visible = wide
      ? cells.flatMap((cell) => cell.items)
      : (cells.find((cell) => cell.iso === day)?.items ?? []);
  }
  const {
    openWithContract,
    panel,
    search,
    seeOverdueList,
    setDay,
    setFilter,
    setMonth,
  } = useInstallmentsRoute(visible, today);
  const prefetch = useCallback(
    (item: InstallmentListItem) => {
      queryClient.prefetchQuery(contractQueryOptions(item.contractId));
      queryClient.prefetchQuery(installmentQueryOptions(item.installmentId));
    },
    [queryClient]
  );
  let body: ReactNode = (
    <InstallmentsList
      groups={groups}
      locale={locale}
      month={month}
      onIntent={prefetch}
      onOpen={panel.openInstallment}
      selectedId={panel.installmentId}
      today={today}
    />
  );
  if (calendar) {
    body = (
      <InstallmentsCalendar
        carried={carried}
        day={day}
        items={gridItems}
        locale={locale}
        month={month}
        onDay={setDay}
        onIntent={prefetch}
        onOpen={panel.openInstallment}
        onSeeCarried={seeOverdueList}
        selectedId={panel.installmentId}
        today={today}
      />
    );
  } else if (groups.length === 0) {
    body = (
      <InstallmentsEmpty
        currentMonth={monthOf(today)}
        filtered={search.filter !== undefined}
        hasContracts={data.hasContracts}
        locale={locale}
        month={month}
        onClearFilter={() => setFilter(undefined)}
        onMonth={setMonth}
      />
    );
  }
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
        {body}
      </div>
      <InstallmentsAside
        contractId={search.contract}
        onOpenWithContract={openWithContract}
        panel={panel}
        urgentContractId={wide ? urgentContract(groups) : null}
      />
    </div>
  );
}
