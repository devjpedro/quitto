import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getLocale } from "@/paraglide/runtime.js";
import { notificationsQueryOptions, useMarkAllReadMutation } from "../api";
import { notificationView } from "../lib/notification-view";
import type { NotificationItem } from "../types";
import { useOpenNotification } from "./use-notifications-panel";

/**
 * What the panel's list shows and does. "Marcar todas" also shows when the
 * bell counts unread ones older than the 50 loaded: otherwise the count would
 * be stuck, with no way to clear it from the panel.
 */
export function useNotificationsList({
  onNavigate,
  unreadCount,
}: {
  onNavigate: () => void;
  unreadCount: number;
}) {
  const { data: items } = useSuspenseQuery(notificationsQueryOptions);
  const markAll = useMarkAllReadMutation();
  const open = useOpenNotification(onNavigate);
  // One clock per open: the rows' "há 2 h" do not tick while the panel is up.
  const [nowMs] = useState(() => Date.now());
  const locale = getLocale();
  return {
    items,
    hasUnread: unreadCount > 0 || items.some((item) => item.readAt === null),
    markAll: () => markAll.mutate(),
    open,
    viewOf: (item: NotificationItem) => notificationView(item, nowMs, locale),
  };
}
