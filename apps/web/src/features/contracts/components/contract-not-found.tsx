import { CaretLeft, FileX } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { m } from "@/paraglide/messages.js";

/** A contract that does not exist or is not yours (decision 20): said in the page, no toast. */
export function ContractNotFound() {
  return (
    <div className="py-6 md:py-10" data-testid="contract-not-found">
      <EmptyState
        action={
          <Button asChild variant="primary">
            <Link to="/contracts">
              <CaretLeft aria-hidden="true" size={16} />
              {m.contract_back()}
            </Link>
          </Button>
        }
        description={m.contract_not_found_description()}
        icon={FileX}
        title={m.contract_not_found_title()}
      />
    </div>
  );
}
