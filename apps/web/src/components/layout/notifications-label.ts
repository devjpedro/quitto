import { pluralForm } from "@/lib/plural";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

/** Accessible name of the bell. It carries the unread count, since the badge is hidden from AT. */
export function notificationsLabel(unreadCount: number): string {
  if (unreadCount === 0) {
    return m.nav_notifications();
  }
  return pluralForm(unreadCount, getLocale()) === "one"
    ? m.nav_notifications_unread_one()
    : m.nav_notifications_unread({ count: unreadCount });
}
