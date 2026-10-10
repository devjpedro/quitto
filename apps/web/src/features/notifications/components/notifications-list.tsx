import { Bell, Checks } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";
import { useNotificationsList } from "../hooks/use-notifications-list";
import { NotificationRow } from "./notification-row";

/**
 * The list's shape while it loads (mockup 10, "carregando"): the filled
 * block, with bones in inset (the default sunken bone is the block's own
 * color in light). `rows` lets a list with another length (the home's
 * "Notificações recentes") keep its shape when the data lands.
 */
export function NotificationsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul
      aria-hidden="true"
      className="divide-y divide-divider overflow-hidden rounded-card bg-surface-card"
    >
      {Array.from({ length: rows }, (_, row) => `row-${row}`).map((key) => (
        <li
          className="flex min-h-[58px] items-center gap-3.5 py-[9px] pr-4 pl-2.5"
          key={key}
        >
          <Skeleton className="size-10 shrink-0 bg-surface-inset" />
          {/* The row's line boxes (NotificationRow): an 18 px title and, 3 px
              below, a 19 px meta line, so the row keeps its 58 px on load. */}
          <div className="flex flex-1 flex-col">
            <div className="flex h-[18px] items-center">
              <Skeleton className="h-3 w-2/3 bg-surface-inset" />
            </div>
            <div className="mt-[3px] flex h-[19px] items-center">
              <Skeleton className="h-2.5 w-1/2 bg-surface-inset" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Nothing to show yet (mockup 10): the bell on a small brand tile, a title and a sentence. */
export function NotificationsEmpty() {
  return (
    <EmptyState
      description={m.notifications_empty_description()}
      icon={Bell}
      iconTile
      title={m.notifications_empty_title()}
      variant="compact"
    />
  );
}

/** The 50 latest notifications, newest first, in one card with straight dividers. */
export function NotificationsList({
  onNavigate,
  unreadCount,
}: {
  onNavigate: () => void;
  unreadCount: number;
}) {
  const { items, hasUnread, markAll, open, viewOf } = useNotificationsList({
    onNavigate,
    unreadCount,
  });
  if (items.length === 0) {
    return <NotificationsEmpty />;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {hasUnread ? (
        <div className="flex justify-end">
          <Button onClick={markAll} size="sm" variant="ghost">
            <Checks aria-hidden="true" size={16} />
            {m.notifications_mark_all()}
          </Button>
        </div>
      ) : null}
      <ul className="divide-y divide-divider overflow-hidden rounded-card bg-surface-card">
        {items.map((item) => (
          // The first and last rows take the block's corners (the row
          // inherits them), so the inset focus ring follows the curve
          // instead of being clipped by it.
          <li
            className="first:rounded-t-card last:rounded-b-card"
            key={item.groupKey}
          >
            <NotificationRow item={item} onOpen={open} view={viewOf(item)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
