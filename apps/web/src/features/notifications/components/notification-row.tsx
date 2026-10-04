import {
  Bell,
  CaretRight,
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
import { IconTile } from "@/components/ui/icon-tile";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { NotificationView } from "../lib/notification-view";
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

/**
 * One line of a notification list (mockup 13): the icon tile as its anchor
 * (with the group's count), the title (semibold while unread, plus "Nova":
 * never color alone), the contract and installments, and a chevron on a
 * group, which opens its contract. The text wraps, never cut (mockup 10):
 * in the phone's sheet a cut group title loses what it says. The line is
 * the tile's `group/row`, so on hover the count's ring takes its fill.
 */
export function NotificationRow({
  item,
  onOpen,
  view,
}: {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
  view: NotificationView;
}) {
  return (
    <button
      className="group/row flex min-h-[58px] w-full items-center gap-3.5 rounded-[inherit] py-[9px] pr-4 pl-2.5 text-left transition-colors hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      onClick={() => onOpen(item)}
      type="button"
    >
      <IconTile
        count={view.count}
        icon={ICON[item.type] ?? Bell}
        tone={view.tone}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-pretty text-sm leading-[1.3]",
            view.unread ? "font-semibold" : "font-normal"
          )}
        >
          {view.title}
        </span>
        <span className="mt-[3px] block text-pretty text-[12.5px] text-ink-muted tabular-nums">
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
      {view.count > 1 ? (
        <CaretRight
          aria-hidden="true"
          className="shrink-0 text-ink-muted"
          size={16}
        />
      ) : null}
    </button>
  );
}
