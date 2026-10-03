import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { optimisticUpdate } from "@/lib/optimistic";
import { queryKeys } from "@/lib/query-keys";
import {
  markAllItemsRead,
  markItemRead,
  withAllRead,
  withOneRead,
} from "./lib/unread";
import type { NotificationItem } from "./types";

interface WithUnread {
  unreadCount: number;
}

export const notificationsQueryOptions = queryOptions({
  queryKey: queryKeys.notifications,
  queryFn: () => unwrap(api.api.notifications.get()),
  // The header's "N não lidas" comes from the home, revalidated on focus: the
  // list refetches on every open (shown from cache meanwhile) so both agree.
  staleTime: 0,
});

/** The bell's part of an optimistic read, only when the home is cached: a rollback must never drop a query the shell observes. */
function optimisticHomeUnread(
  qc: QueryClient,
  update: (home: WithUnread) => WithUnread
): Promise<() => void> {
  if (qc.getQueryData(queryKeys.home) === undefined) {
    return Promise.resolve(() => undefined);
  }
  return optimisticUpdate<WithUnread>(
    qc,
    queryKeys.home,
    (home) => home && update(home)
  );
}

/** Reading one updates the list and the bell at once; the home (where the count lives) refreshes after. */
export function useMarkReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.api.notifications({ id }).read.post()),
    onMutate: async (id: string) => {
      const wasUnread =
        qc
          .getQueryData<NotificationItem[]>(queryKeys.notifications)
          ?.some((item) => item.id === id && item.readAt === null) ?? true;
      const readAt = new Date().toISOString();
      const rollbackList = await optimisticUpdate<NotificationItem[]>(
        qc,
        queryKeys.notifications,
        (items) => items && markItemRead(items, id, readAt)
      );
      const rollbackHome = wasUnread
        ? await optimisticHomeUnread(qc, withOneRead)
        : () => undefined;
      return () => {
        rollbackList();
        rollbackHome();
      };
    },
    onError: (_error, _id, rollback) => {
      rollback?.();
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
}

export function useMarkAllReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.notifications["read-all"].post()),
    onMutate: async () => {
      const readAt = new Date().toISOString();
      const rollbackList = await optimisticUpdate<NotificationItem[]>(
        qc,
        queryKeys.notifications,
        (items) => items && markAllItemsRead(items, readAt)
      );
      const rollbackHome = await optimisticHomeUnread(qc, withAllRead);
      return () => {
        rollbackList();
        rollbackHome();
      };
    },
    onError: (_error, _variables, rollback) => {
      rollback?.();
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
}
