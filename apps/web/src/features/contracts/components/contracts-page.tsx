import { Plus } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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

function ContractsContent({ onEmpty }: { onEmpty: (empty: boolean) => void }) {
  const { data } = useSuspenseQuery(contractsQueryOptions);
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const change = useCallback(
    (next: ContractsListSearch) =>
      navigate({ search: next, replace: true, resetScroll: false }),
    [navigate]
  );
  const none = data.length === 0;
  useEffect(() => onEmpty(none), [none, onEmpty]);
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
          hasContracts={data.length > 0}
          onShowAll={() => change({ ...search, side: undefined })}
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
 * "Contratos" (mockup 17, frame A). The title and the desktop "+ Novo
 * contrato" draw at once; the cards stream in one section. Same breathing
 * room and 1840 px stop as the home.
 */
export function ContractsPage() {
  useDocumentTitle(m.page_title_contracts());
  // No contracts: the empty state has the one "Novo contrato" (decision 11).
  // Reported by the list below: a second reader of the query out here would
  // change how the section's own error reaches its boundary.
  const [hasNone, setHasNone] = useState(false);
  return (
    <div className="lateral:p-8 p-4 md:p-6" data-testid="contracts-page">
      <div className="mx-auto flex w-full max-w-[1840px] flex-col gap-4 md:gap-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-bold font-display text-[28px] leading-[1.1] tracking-[-0.035em] md:text-[32px]">
            {m.contracts_title()}
          </h1>
          {hasNone ? null : (
            <Button asChild className="hidden md:inline-flex">
              <Link to="/contracts/new">
                <Plus aria-hidden="true" size={16} weight="bold" />
                {m.nav_new_contract()}
              </Link>
            </Button>
          )}
        </div>
        <SectionBoundary fallback={<ContractsSkeleton />}>
          <ContractsContent onEmpty={setHasNone} />
        </SectionBoundary>
      </div>
    </div>
  );
}
