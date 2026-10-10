import { useNavigate } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useState } from "react";
import { useMarkReadMutation } from "../api";
import { notificationTarget } from "../lib/notification-view";
import type { NotificationItem } from "../types";

/** Open state of the bell panel; the shell layout owns it. */
export function useNotificationsPanel() {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  return { open, setOpen, show };
}

/**
 * The shell layout's "open the bell panel", for page content (the home's
 * "Notificações recentes › Ver todas"). `_app.tsx` provides it next to the
 * panel's state; the default is a no-op, for content rendered alone in tests.
 */
export const NotificationsPanelContext = createContext<() => void>(
  () => undefined
);

export function useShowNotifications(): () => void {
  return useContext(NotificationsPanelContext);
}

/**
 * Opening a line marks it read (all of it), closes the panel and goes to its
 * installment, or to the contract filtered when the line is a group.
 */
export function useOpenNotification(onNavigate: () => void) {
  const markRead = useMarkReadMutation();
  const navigate = useNavigate();
  return (item: NotificationItem) => {
    if (item.readAt === null) {
      markRead.mutate(item);
    }
    onNavigate();
    navigate({
      to: "/contracts/$id",
      params: { id: item.contractId },
      search: notificationTarget(item),
    });
  };
}
