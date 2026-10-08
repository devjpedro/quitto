import { Users } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { m } from "@/paraglide/messages.js";

/** Nobody yet (mockup 09, frame 4): what will fill the page, and the way to it. */
export function PeopleEmpty() {
  return (
    <div data-testid="people-empty">
      <EmptyState
        action={
          <Button asChild size="sm" variant="inset">
            <Link to="/contracts">{m.people_page_empty_action()}</Link>
          </Button>
        }
        description={m.people_page_empty_description()}
        icon={Users}
        title={m.people_page_empty_title()}
        variant="compact"
      />
    </div>
  );
}
