import { CheckCircle, Files, FileText, Plus } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyStage } from "@/components/ui/empty-stage";
import { EmptyState } from "@/components/ui/empty-state";
import { TourButton } from "@/features/tour/components/tour-button";
import { m } from "@/paraglide/messages.js";
import type { ContractsListSearch } from "../lib/contracts-list-search";

/** What the list says when it has nothing to show (mockup 09, frames 2 and 4). */
export function ContractsEmpty({
  doneCount,
  hasContracts,
  onShowAll,
  onShowDone,
  search,
}: {
  /** Settled contracts: with none active, this is "everything paid", not an error. */
  doneCount: number;
  hasContracts: boolean;
  onShowAll: () => void;
  onShowDone: () => void;
  search: ContractsListSearch;
}) {
  if (!hasContracts) {
    return (
      <div data-testid="contracts-empty">
        <EmptyStage
          actions={
            <>
              <Button asChild>
                <Link to="/contracts/new">
                  <Plus aria-hidden="true" size={16} weight="bold" />
                  {m.nav_new_contract()}
                </Link>
              </Button>
              <TourButton />
            </>
          }
          description={m.contracts_empty_description()}
          icon={Files}
          state="new"
          title={m.contracts_empty_title()}
        />
      </div>
    );
  }
  if (search.show !== "done" && !search.side && doneCount > 0) {
    return (
      <div data-testid="contracts-empty">
        <EmptyStage
          actions={
            <>
              <Button onClick={onShowDone} variant="inset">
                {m.contracts_view_done()}
              </Button>
              <Button asChild>
                <Link to="/contracts/new">
                  <Plus aria-hidden="true" size={16} weight="bold" />
                  {m.nav_new_contract()}
                </Link>
              </Button>
            </>
          }
          description={m.contracts_empty_active_description()}
          icon={Files}
          state="done"
          title={m.contracts_empty_active_title()}
        />
      </div>
    );
  }
  if (search.show === "done") {
    return (
      <div data-testid="contracts-empty">
        <EmptyState
          description={m.contracts_empty_done_description()}
          icon={CheckCircle}
          title={m.contracts_empty_done_title()}
          variant="compact"
        />
      </div>
    );
  }
  return (
    <div data-testid="contracts-empty">
      <EmptyState
        action={
          <Button onClick={onShowAll} size="sm" variant="inset">
            {m.contracts_show_all()}
          </Button>
        }
        description=""
        icon={FileText}
        title={
          search.side === "pay"
            ? m.contracts_empty_pay()
            : m.contracts_empty_receive()
        }
        variant="compact"
      />
    </div>
  );
}
