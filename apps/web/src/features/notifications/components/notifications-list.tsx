import { Bell, Checks } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";
import { useNotificationsList } from "../hooks/use-notifications-list";
import { NotificationRow } from "./notification-row";

/** The list's shape while it loads (mockup 10, "carregando"). */
export function NotificationsSkeleton() {
  return (
    <ul
      aria-hidden="true"
      className="divide-y divide-line overflow-hidden rounded-card border border-line"
    >
      {["a", "b", "c"].map((row) => (
        <li className="flex items-start gap-3 px-3.5 py-3" key={row}>
          <Skeleton className="size-8 shrink-0" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
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
