import { Bell, Checks } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useNotificationsList } from "../hooks/use-notifications-list";
import { NotificationRow } from "./notification-row";

/**
 * The list's shape while it loads (mockup 10, "carregando"). `rows` and
 * `className` let a list with another length or background (the home's
 * "Notificações recentes") keep its shape when the data lands.
 */
export function NotificationsSkeleton({
  className,
  rows = 3,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <ul
      aria-hidden="true"
      className={cn(
        "divide-y divide-line overflow-hidden rounded-card border border-line",
        className
      )}
    >
      {Array.from({ length: rows }, (_, row) => `row-${row}`).map((key) => (
        <li className="flex items-start gap-3 px-3.5 py-3" key={key}>
          <Skeleton className="size-8 shrink-0" />
          {/* The row's line boxes (NotificationRow): a 20 px title and, 2 px
              below, a 16 px meta line, so the row keeps its height on load. */}
          <div className="flex flex-1 flex-col">
            <div className="flex h-5 items-center">
              <Skeleton className="h-3 w-2/3" />
            </div>
            <div className="mt-0.5 flex h-4 items-center">
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Nothing to show yet (mockup 10): the bell in the rows' brand tile, a title and a sentence. */
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
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">
        {items.map((item) => (
          <li key={item.id}>
            <NotificationRow item={item} onOpen={open} view={viewOf(item)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
