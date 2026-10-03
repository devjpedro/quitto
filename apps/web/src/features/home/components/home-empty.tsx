import { Lightning, Plus } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyState, GhostCard, GhostLine } from "@/components/ui/empty-state";
import { m } from "@/paraglide/messages.js";

const GHOST_BUTTON =
  "block h-7 w-24 rounded-control border-[1.5px] border-line-strong border-dashed";

/**
 * No contract and the guide dismissed: the dashed outline of the card that
 * will fill the space (the action card: tag, meta, amount, detail and its two
 * buttons, mockup 11 §2), one sentence, one action. `data-home-empty` lets
 * the page drop its header shortcut, so that action stays the only one.
 */
export function HomeEmpty() {
  return (
    <div data-home-empty="">
      <EmptyState
        action={
          <Button asChild>
            <Link to="/contracts/new">
              <Plus aria-hidden="true" size={16} weight="bold" />
              {m.home_empty_cta()}
            </Link>
          </Button>
        }
        description={m.home_empty_description()}
        icon={Lightning}
        preview={
          // On mobile the page itself is surface-sunken, the color of the ghost
          // lines: the outlines need the raised surface for their lines to show.
          <>
            <GhostCard className="border-brand/50 bg-surface-raised">
              <GhostLine height="16px" width="64px" />
              <GhostLine width="50%" />
              <GhostLine height="22px" width="34%" />
              <GhostLine width="40%" />
              <span className="mt-1 flex gap-2">
                <span className={GHOST_BUTTON} />
                <span className={GHOST_BUTTON} />
              </span>
            </GhostCard>
            <GhostCard className="bg-surface-raised opacity-60">
              <GhostLine height="16px" width="64px" />
              <GhostLine width="45%" />
              <GhostLine height="18px" width="30%" />
            </GhostCard>
          </>
        }
        title={m.home_empty_title()}
      />
    </div>
  );
}
