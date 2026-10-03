import { Bell, Checks } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { notificationsQueryOptions, useMarkAllReadMutation } from "../api";
import { useOpenNotification } from "../hooks/use-notifications-panel";
import { notificationView } from "../lib/notification-view";
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
          <span className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The 50 latest notifications, newest first, in one card with straight dividers. */
export function NotificationsList({ onNavigate }: { onNavigate: () => void }) {
  const { data: items } = useSuspenseQuery(notificationsQueryOptions);
  const markAll = useMarkAllReadMutation();
  const open = useOpenNotification(onNavigate);
  const [nowMs] = useState(() => Date.now());
  const locale = getLocale();
  if (items.length === 0) {
    return (
      <EmptyState
        description={m.notifications_empty_description()}
        icon={Bell}
        title={m.notifications_empty_title()}
        variant="compact"
      />
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {items.some((item) => item.readAt === null) ? (
        <div className="flex justify-end">
          <Button onClick={() => markAll.mutate()} size="sm" variant="ghost">
            <Checks aria-hidden="true" size={16} />
            {m.notifications_mark_all()}
          </Button>
        </div>
      ) : null}
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">
        {items.map((item) => (
          <li key={item.id}>
            <NotificationRow
              item={item}
              onOpen={open}
              view={notificationView(item, nowMs, locale)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
