import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback } from "react";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { contractsQueryOptions } from "@/hooks/use-contracts";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { todayISO } from "@/lib/format";
import { m } from "@/paraglide/messages.js";
import { contractsFilter } from "../lib/contracts-filter";
import type { ContractsListSearch } from "../lib/contracts-list-search";
import { ContractCard } from "./contract-card";
import { ContractsEmpty } from "./contracts-empty";
import { CARD_GRID } from "./contracts-grid";
import { ContractsSkeleton } from "./contracts-skeleton";
import { ContractsToolbar } from "./contracts-toolbar";

const route = getRouteApi("/_app/contracts/");

function ContractsContent() {
  const { data } = useSuspenseQuery(contractsQueryOptions);
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const change = useCallback(
    (next: ContractsListSearch) =>
      navigate({ search: next, replace: true, resetScroll: false }),
    [navigate]
  );
  const { cards, counts, totals } = contractsFilter(data, search);
  const today = todayISO();
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      {data.length > 0 ? (
        <ContractsToolbar
          counts={counts}
          onChange={change}
          search={search}
          totals={totals}
        />
      ) : null}
      {cards.length === 0 ? (
        <ContractsEmpty
          doneCount={counts.done}
          hasContracts={data.length > 0}
          onShowAll={() => change({ ...search, side: undefined })}
          onShowDone={() => change({ ...search, show: "done" })}
          search={search}
        />
      ) : (
        <div className={CARD_GRID}>
          {cards.map((item) => (
            <ContractCard item={item} key={item.id} today={today} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * "Contratos" (mockup 20, B4). Only the title in the header: "Novo contrato"
 * is the sidebar's (the ＋ of the tab bar on a phone, the empty state's own),
 * once per screen like the home. Same breathing room and 1840 px stop.
 */
export function ContractsPage() {
  useDocumentTitle(m.page_title_contracts());
  return (
    <div className="lateral:p-8 p-4 md:p-6" data-testid="contracts-page">
      <div className="mx-auto flex w-full max-w-[1840px] flex-col gap-4 md:gap-5">
        <h1 className="font-bold font-display text-[28px] leading-[1.1] tracking-[-0.035em] md:text-[32px]">
          {m.contracts_title()}
        </h1>
        <SectionBoundary fallback={<ContractsSkeleton />}>
          <ContractsContent />
        </SectionBoundary>
      </div>
    </div>
  );
}
