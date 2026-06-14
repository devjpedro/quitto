import { useNavigate } from "@tanstack/react-router";
import {
  type NotificationItem,
  NotificationList,
} from "@/components/notification-list";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMarkAllReadMutation,
  useMarkReadMutation,
  useNotificationsQuery,
} from "@/hooks/use-notifications";

export function NotificationsPage() {
  const navigate = useNavigate();
  const { data, isPending } = useNotificationsQuery();
  const markRead = useMarkReadMutation();
  const markAll = useMarkAllReadMutation();

  function handleOpen(item: NotificationItem) {
    if (!item.readAt) {
      markRead.mutate(item.id);
    }
    navigate({
      to: "/contracts/$id",
      params: { id: item.contractId },
      search: { installment: item.installmentId ?? undefined },
    });
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-bold font-display text-xl tracking-tight sm:text-2xl">
          Notificações
        </h1>
        {!isPending && (data?.length ?? 0) > 0 ? (
          <button
            className="self-start rounded px-2 py-1 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:self-auto"
            onClick={() => markAll.mutate()}
            type="button"
          >
            Marcar todas como lidas
          </button>
        ) : null}
      </div>
      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <NotificationList items={data ?? []} onOpen={handleOpen} />
        </div>
      )}
    </div>
  );
}
