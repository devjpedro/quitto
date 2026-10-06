import { CaretRight } from "@phosphor-icons/react";
import { useId } from "react";
import { SectionTitle } from "@/components/ui/section-title";
import type { HomeAction } from "@/features/home/types";
import { m } from "@/paraglide/messages.js";
import { useNotificationRows } from "../hooks/use-notifications-list";
import { useShowNotifications } from "../hooks/use-notifications-panel";
import { useRecentNotifications } from "../hooks/use-recent-notifications";
import type { NotificationItem } from "../types";
import { NotificationRow } from "./notification-row";

/** No panel to close: the row navigates from the page itself. */
const stayOnPage = () => undefined;

function RecentList({ items }: { items: NotificationItem[] }) {
  const { open, viewOf } = useNotificationRows(stayOnPage);
  return (
    <ul className="divide-y divide-divider overflow-hidden rounded-card bg-surface-card">
      {items.map((item) => (
        // The first and last rows take the block's corners (the row inherits
        // them), so the inset focus ring follows the curve instead of being
        // clipped by it.
        <li
          className="first:rounded-t-card last:rounded-b-card"
          key={item.groupKey}
        >
          <NotificationRow item={item} onOpen={open} view={viewOf(item)} />
        </li>
      ))}
    </ul>
  );
}

/**
 * "Notificações recentes" in the home's side column (mockup 12): the 4
 * latest, with the bell panel's rows (mockup 10). Hidden below lateral by
 * CSS, so the HTML is the same at any width; "Ver todas" opens the panel.
 * Only what no action card already says (DIRECAO › Home enxuta). It enters
 * only with a row: no skeleton while loading (it would flash and vanish on
 * most accounts, and move the layout), and gone when the list fails with
 * nothing in cache or nothing is left: the panel keeps its own empty state.
 * A failed refetch keeps the cached rows, as the panel does.
 */
export function RecentNotifications({ actions }: { actions: HomeAction[] }) {
  const headingId = useId();
  const { items } = useRecentNotifications(actions);
  const showAll = useShowNotifications();
  if (!items || items.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby={headingId} className="lateral:block hidden">
      <SectionTitle
        aux={
          <button
            aria-haspopup="dialog"
            className="inline-flex items-center gap-1 rounded-control font-medium text-[13px] text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            onClick={showAll}
            type="button"
          >
            {m.home_recent_notifications_all()}
            <CaretRight aria-hidden="true" size={14} />
          </button>
        }
        id={headingId}
      >
        {m.home_recent_notifications()}
      </SectionTitle>
      <RecentList items={items} />
    </section>
  );
}
