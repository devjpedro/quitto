import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  markAllItemsRead,
  markItemRead,
  unmarkItemsRead,
  withAllRead,
  withReadCount,
  withUnreadAdded,
  withUnreadCount,
} from "./lib/unread";
import type { NotificationItem } from "./types";

interface WithUnread {
  unreadCount: number;
}

/**
 * Shared by both reads, so the home's queryFn sees one in flight and keeps a
 * home read from bringing the bell's count back up meanwhile.
 */
export const NOTIFICATION_READ_KEY = ["notification-read"] as const;

export const notificationsQueryOptions = queryOptions({
  queryKey: queryKeys.notifications,
  queryFn: () => unwrap(api.api.notifications.get()),
  // The header's "N não lidas" comes from the home, revalidated on focus: the
  // list refetches on every open (shown from cache meanwhile) so both agree.
  staleTime: 0,
});

/**
 * Changes only the bell's count, and only when the home has data: writing an
 * empty home would create the entry the shell observes. A home read in flight
 * is not cancelled: it lands through the home's queryFn, which keeps the count
 * from going back up while a read is pending.
 */
function updateHomeUnread(
  qc: QueryClient,
  update: (home: WithUnread) => WithUnread
) {
  qc.setQueryData<WithUnread>(queryKeys.home, (home) => home && update(home));
}

/** Marks rows read in the cached list (if cached), after any list fetch in flight is dropped. */
async function markListRead(
  qc: QueryClient,
  mark: (items: NotificationItem[]) => NotificationItem[]
) {
  await qc.cancelQueries({ queryKey: queryKeys.notifications });
  qc.setQueryData<NotificationItem[]>(
    queryKeys.notifications,
    (items) => items && mark(items)
  );
}

/**
 * A failed read puts back only its own part: the rows it marked and the
 * count it took. Never a snapshot of the list or of the home taken before
 * other taps (another read, an action leaving the home).
 */
function undoRead(
  qc: QueryClient,
  ids: readonly string[],
  readAt: string,
  restoreCount: ((home: WithUnread) => WithUnread) | null
) {
  qc.setQueryData<NotificationItem[]>(
    queryKeys.notifications,
    (items) => items && unmarkItemsRead(items, ids, readAt)
  );
  if (restoreCount) {
    updateHomeUnread(qc, restoreCount);
  }
  qc.invalidateQueries({ queryKey: queryKeys.notifications });
}

/**
 * Reading a line reads every notification behind it (a grouped line is
 * many): the list and the bell change at once, the bell by the line's
 * unread count. The home (where the count lives) refreshes after.
 */
export function useMarkReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: NOTIFICATION_READ_KEY,
    mutationFn: (item: NotificationItem) =>
      unwrap(api.api.notifications.read.post({ ids: item.ids })),
    onMutate: async (item: NotificationItem) => {
      const cached = qc
        .getQueryData<NotificationItem[]>(queryKeys.notifications)
        ?.find((row) => row.id === item.id);
      const line = cached ?? item;
      const unreadInLine = line.readAt === null ? line.unreadCount : 0;
      const readAt = new Date().toISOString();
      await markListRead(qc, (items) => markItemRead(items, item.id, readAt));
      // Never take more than the bell shows, so a failure never adds one back.
      const took = Math.min(
        unreadInLine,
        qc.getQueryData<WithUnread>(queryKeys.home)?.unreadCount ?? 0
      );
      if (took > 0) {
        updateHomeUnread(qc, (home) => withReadCount(home, took));
      }
      return { readAt, took };
    },
    onError: (_error, item, context) => {
      if (context) {
        const { took } = context;
        undoRead(
          qc,
          [item.id],
          context.readAt,
          took > 0 ? (home) => withUnreadAdded(home, took) : null
        );
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
}

export function useMarkAllReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: NOTIFICATION_READ_KEY,
    mutationFn: () => unwrap(api.api.notifications["read-all"].post()),
    onMutate: async () => {
      const ids = (
        qc.getQueryData<NotificationItem[]>(queryKeys.notifications) ?? []
      )
        .filter((item) => item.readAt === null)
        .map((item) => item.id);
      const readAt = new Date().toISOString();
      await markListRead(qc, (items) => markAllItemsRead(items, readAt));
      const previousCount =
        qc.getQueryData<WithUnread>(queryKeys.home)?.unreadCount ?? null;
      updateHomeUnread(qc, withAllRead);
      return { ids, previousCount, readAt };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        const { previousCount } = context;
        undoRead(
          qc,
          context.ids,
          context.readAt,
          previousCount === null
            ? null
            : (home) => withUnreadCount(home, previousCount)
        );
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
}
