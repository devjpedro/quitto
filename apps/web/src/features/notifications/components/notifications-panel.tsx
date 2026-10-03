import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { pluralForm } from "@/lib/plural";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { NotificationsList, NotificationsSkeleton } from "./notifications-list";

/**
 * The history opened by the bell: a side panel from md up, a bottom sheet
 * below. The list is fetched when the panel opens, since the sheet only
 * mounts its content while open.
 */
export function NotificationsPanel({
  fallbackFocus,
  onOpenChange,
  open,
  unreadCount,
}: {
  /** Where the focus goes on close when what opened it left the page (the ⌘K palette). */
  fallbackFocus?: () => HTMLElement | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  unreadCount: number;
}) {
  let description: string | undefined;
  if (unreadCount > 0) {
    description =
      pluralForm(unreadCount, getLocale()) === "one"
        ? m.notifications_unread_one()
        : m.notifications_unread_other({ count: unreadCount });
  }
  return (
    <ResponsiveSheet
      description={description}
      fallbackFocus={fallbackFocus}
      onOpenChange={onOpenChange}
      open={open}
      title={m.notifications_title()}
    >
      <SectionBoundary fallback={<NotificationsSkeleton />}>
        <NotificationsList
          onNavigate={() => onOpenChange(false)}
          unreadCount={unreadCount}
        />
      </SectionBoundary>
    </ResponsiveSheet>
  );
}
