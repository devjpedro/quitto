import { Lightning, Plus } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyStage } from "@/components/ui/empty-stage";
import { TourButton } from "@/features/tour/components/tour-button";
import { m } from "@/paraglide/messages.js";

/**
 * No contract and the guide dismissed (mockup 20, B8): no ghost card, the
 * ring's track as the anchor, one sentence, and the first contract or the
 * tour. `data-home-empty` marks the state for the page.
 */
export function HomeEmpty() {
  return (
    <div data-home-empty="">
      <EmptyStage
        actions={
          <>
            <Button asChild>
              <Link to="/contracts/new">
                <Plus aria-hidden="true" size={16} weight="bold" />
                {m.home_empty_cta()}
              </Link>
            </Button>
            <TourButton />
          </>
        }
        description={m.home_empty_description()}
        icon={Lightning}
        state="new"
        title={m.home_empty_title()}
      />
    </div>
  );
}
