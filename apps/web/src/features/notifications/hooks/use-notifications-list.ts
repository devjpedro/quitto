import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getLocale } from "@/paraglide/runtime.js";
import { notificationsQueryOptions, useMarkAllReadMutation } from "../api";
import { notificationView } from "../lib/notification-view";
import type { NotificationItem } from "../types";
import { useOpenNotification } from "./use-notifications-panel";

/**
 * What every list of notification rows needs (the bell panel and the home's
 * "Notificações recentes"): opening a row, and its text in the reader's
 * language against one clock per mount, so "há 2 h" does not tick on screen.
 */
export function useNotificationRows(onNavigate: () => void) {
  const open = useOpenNotification(onNavigate);
  const [nowMs] = useState(() => Date.now());
  const locale = getLocale();
  return {
    open,
    viewOf: (item: NotificationItem) => notificationView(item, nowMs, locale),
  };
}

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
  // One clock per open: the rows' "há 2 h" do not tick while the panel is up.
  const { open, viewOf } = useNotificationRows(onNavigate);
  return {
    items,
    hasUnread: unreadCount > 0 || items.some((item) => item.readAt === null),
    markAll: () => markAll.mutate(),
    open,
    viewOf,
  };
}
