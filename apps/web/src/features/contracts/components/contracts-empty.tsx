import { CheckCircle, FileText } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyState, GhostCard, GhostLine } from "@/components/ui/empty-state";
import { m } from "@/paraglide/messages.js";
import type { ContractsListSearch } from "../lib/contracts-list-search";

function Preview() {
  return (
    <>
      {[0, 1].map((key) => (
        <GhostCard key={key}>
          <GhostLine height="16px" width="72px" />
          <GhostLine width="55%" />
          <GhostLine height="24px" width="28%" />
          <GhostLine height="6px" width="100%" />
        </GhostCard>
      ))}
    </>
  );
}

/** What the list says when it has nothing to show (mockup 09, frames 2 and 4). */
export function ContractsEmpty({
  hasContracts,
  onShowAll,
  search,
}: {
  hasContracts: boolean;
  onShowAll: () => void;
  search: ContractsListSearch;
}) {
  if (!hasContracts) {
    return (
      <div data-testid="contracts-empty">
        <EmptyState
          action={
            <Button asChild>
              <Link to="/contracts/new">{m.nav_new_contract()}</Link>
            </Button>
          }
          description={m.contracts_empty_description()}
          icon={FileText}
          preview={<Preview />}
          title={m.contracts_empty_title()}
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
