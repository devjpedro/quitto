import {
  Bell,
  CheckCircle,
  Clock,
  FileMagnifyingGlass,
  type Icon,
  UserMinus,
  UserPlus,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { NOTIFICATION_TYPE } from "@quitto/shared";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type {
  NotificationTone,
  NotificationView,
} from "../lib/notification-view";
import type { NotificationItem } from "../types";

const ICON: Record<string, Icon> = {
  [NOTIFICATION_TYPE.proofSubmitted]: FileMagnifyingGlass,
  [NOTIFICATION_TYPE.paymentConfirmed]: CheckCircle,
  [NOTIFICATION_TYPE.paymentDisputed]: XCircle,
  [NOTIFICATION_TYPE.installmentPaid]: CheckCircle,
  [NOTIFICATION_TYPE.installmentDueSoon]: Clock,
  [NOTIFICATION_TYPE.installmentDueSoonReceivable]: Clock,
  [NOTIFICATION_TYPE.installmentOverdue]: WarningCircle,
  [NOTIFICATION_TYPE.installmentOverdueReceivable]: WarningCircle,
  [NOTIFICATION_TYPE.participantLeft]: UserMinus,
  [NOTIFICATION_TYPE.inviteAccepted]: UserPlus,
  [NOTIFICATION_TYPE.inviteDeclined]: UserMinus,
};

const TILE: Record<NotificationTone, string> = {
  brand: "bg-brand-subtle text-brand",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  neutral: "bg-surface-sunken text-ink-muted",
};

/** One row of the panel. Unread: semibold title + "Nova" tag (never color alone, never faded). */
export function NotificationRow({
  item,
  onOpen,
  view,
}: {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
  view: NotificationView;
}) {
  const IconComponent = ICON[item.type] ?? Bell;
  return (
    <button
      className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      onClick={() => onOpen(item)}
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-control",
          TILE[view.tone]
        )}
      >
        <IconComponent size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm",
            view.unread ? "font-semibold" : "font-normal"
          )}
        >
          {view.title}
        </span>
        <span className="mt-0.5 block text-ink-muted text-xs tabular-nums">
          {view.meta}
        </span>
        {view.reason ? (
          <span className="mt-1 block text-ink-muted text-xs">
            {view.reason}
          </span>
        ) : null}
      </span>
      {view.unread ? (
        <Tag className="self-center" tone="highlight">
          {m.notifications_new()}
        </Tag>
      ) : null}
    </button>
  );
}
