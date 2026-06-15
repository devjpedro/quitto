import type { NotificationType } from "@quitto/shared";
import { BellOff } from "lucide-react";
import { formatRelativeTimeBR } from "@/lib/format";
import {
  NOTIFICATION_FALLBACK_ICON,
  NOTIFICATION_TYPE_ICON,
  NOTIFICATION_TYPE_LABEL,
} from "@/lib/labels";

export interface NotificationItem {
  contractId: string;
  createdAt: string;
  id: string;
  installmentId: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  type: string;
}

function messageFor(item: NotificationItem): string {
  const base =
    NOTIFICATION_TYPE_LABEL[item.type as NotificationType] ?? "Notificação";
  const reason =
    typeof item.metadata?.reason === "string" ? item.metadata.reason : null;
  return reason ? `${base}: ${reason}` : base;
}

export function NotificationList({
  items,
  onOpen,
}: {
  items: NotificationItem[];
  onOpen: (item: NotificationItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <BellOff
          aria-hidden="true"
          className="size-8 text-muted-foreground/40"
        />
        <p className="font-display text-muted-foreground text-sm">
          Nenhuma notificação por aqui.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const Icon =
          NOTIFICATION_TYPE_ICON[item.type as NotificationType] ??
          NOTIFICATION_FALLBACK_ICON;
        const isUnread = item.readAt === null;
        const message = messageFor(item);

        return (
          <li className="relative" key={item.id}>
            <span
              aria-hidden="true"
              className={`absolute inset-y-0 left-0 w-0.5 rounded-r-full transition-colors ${
                isUnread ? "bg-primary/70" : "bg-transparent"
              }`}
            />

            <button
              aria-label={`${message}, ${formatRelativeTimeBR(item.createdAt)}`}
              className={`group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset ${
                isUnread ? "" : "opacity-60"
              }`}
              data-testid={`notification-${item.id}`}
              onClick={() => onOpen(item)}
              type="button"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary transition-colors group-hover:bg-primary/15"
              >
                <Icon className="size-4" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground text-sm">
                  {message}
                </span>
                <span className="mt-0.5 block text-muted-foreground text-xs tabular-nums">
                  {formatRelativeTimeBR(item.createdAt)}
                </span>
              </span>

              {isUnread ? (
                <span
                  aria-hidden="true"
                  className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
