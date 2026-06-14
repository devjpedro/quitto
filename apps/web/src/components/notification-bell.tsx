import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useMarkAllReadMutation,
  useMarkReadMutation,
  useNotificationsQuery,
  useUnreadCountQuery,
} from "@/hooks/use-notifications";
import { formatUnreadCount } from "@/lib/format";
import { type NotificationItem, NotificationList } from "./notification-list";

const POPOVER_LIMIT = 8;

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: counter } = useUnreadCountQuery();
  const { data: items } = useNotificationsQuery();
  const markRead = useMarkReadMutation();
  const markAll = useMarkAllReadMutation();
  const count = counter?.count ?? 0;
  const recent = (items ?? []).slice(0, POPOVER_LIMIT);

  function handleOpen(item: NotificationItem) {
    setOpen(false);
    if (!item.readAt) {
      markRead.mutate(item.id);
    }
    navigate({
      to: "/contracts/$id",
      params: { id: item.contractId },
      search: { installment: item.installmentId ?? undefined },
    });
  }

  function handleSeeAll() {
    setOpen(false);
    navigate({ to: "/notifications" });
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label={`Notificações${count > 0 ? `, ${count} não lidas` : ""}`}
        className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95 data-[state=open]:bg-muted data-[state=open]:text-foreground"
      >
        <Bell aria-hidden="true" className="size-4" />
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1 font-semibold text-[10px] text-primary-foreground leading-none shadow-sm ring-1 ring-background"
          >
            {formatUnreadCount(count)}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 rounded-xl border-border p-0 shadow-lg"
      >
        <div className="flex items-center justify-between border-border border-b px-4 py-3">
          <span className="font-display font-semibold text-foreground text-sm tracking-tight">
            Notificações
          </span>
          {count > 0 ? (
            <button
              className="rounded text-muted-foreground text-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              onClick={() => markAll.mutate()}
              type="button"
            >
              Marcar todas como lidas
            </button>
          ) : null}
        </div>
        <div className="max-h-96 overflow-y-auto">
          <NotificationList items={recent} onOpen={handleOpen} />
        </div>
        {recent.length > 0 ? (
          <div className="border-border border-t p-1.5">
            <button
              className="w-full rounded-lg px-3 py-2 text-center font-medium text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              onClick={handleSeeAll}
              type="button"
            >
              Ver todas as notificações
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
