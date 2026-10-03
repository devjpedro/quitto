import { useId } from "react";
import { m } from "@/paraglide/messages.js";
import { useNotificationRows } from "../hooks/use-notifications-list";
import { useShowNotifications } from "../hooks/use-notifications-panel";
import {
  RECENT_COUNT,
  useRecentNotifications,
} from "../hooks/use-recent-notifications";
import type { NotificationItem } from "../types";
import { NotificationRow } from "./notification-row";
import {
  NotificationsEmpty,
  NotificationsSkeleton,
} from "./notifications-list";

/** No panel to close: the row navigates from the page itself. */
const stayOnPage = () => undefined;

function RecentList({ items }: { items: NotificationItem[] }) {
  const { open, viewOf } = useNotificationRows(stayOnPage);
  if (items.length === 0) {
    return <NotificationsEmpty />;
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-raised">
      {items.map((item) => (
        <li key={item.id}>
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
 * Gone when the list fails with nothing in cache (the panel has its own
 * boundary); a failed refetch keeps the cached rows, as the panel does.
 */
export function RecentNotifications() {
  const headingId = useId();
  const { isError, items } = useRecentNotifications();
  const showAll = useShowNotifications();
  if (isError && !items) {
    return null;
  }
  return (
    <section
      aria-labelledby={headingId}
      className="lateral:flex hidden flex-col gap-2"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium text-ink-muted text-sm" id={headingId}>
          {m.home_recent_notifications()}
        </h2>
        <button
          aria-haspopup="dialog"
          className="rounded-control font-medium text-ink text-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onClick={showAll}
          type="button"
        >
          {m.home_recent_notifications_all()}
        </button>
      </div>
      {items ? (
        <RecentList items={items} />
      ) : (
        // The loaded list's shape: up to 4 rows on the raised surface.
        <NotificationsSkeleton
          className="bg-surface-raised"
          rows={RECENT_COUNT}
        />
      )}
    </section>
  );
}
