import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useMarkReadMutation } from "../api";
import type { NotificationItem } from "../types";

/** Open state of the bell panel; the shell layout owns it. */
export function useNotificationsPanel() {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  return { open, setOpen, show };
}

/** Opening a notification marks it read, closes the panel and goes to its installment. */
export function useOpenNotification(onNavigate: () => void) {
  const markRead = useMarkReadMutation();
  const navigate = useNavigate();
  return (item: NotificationItem) => {
    if (item.readAt === null) {
      markRead.mutate(item.id);
    }
    onNavigate();
    navigate({
      to: "/contracts/$id",
      params: { id: item.contractId },
      search: { installment: item.installmentId ?? undefined },
    });
  };
}
