import { Plus, Users } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyStage } from "@/components/ui/empty-stage";
import { TourButton } from "@/features/tour/components/tour-button";
import { m } from "@/paraglide/messages.js";

/** Nobody yet (mockup 20, B8): the ring's track, one sentence and the way to the first contract. */
export function PeopleEmpty() {
  return (
    <div data-testid="people-empty">
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
        description={m.people_page_empty_description()}
        icon={Users}
        state="new"
        title={m.people_page_empty_title()}
      />
    </div>
  );
}
