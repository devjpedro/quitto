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
  withOneRead,
  withOneUnread,
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

/** Reading one updates the list and the bell at once; the home (where the count lives) refreshes after. */
export function useMarkReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: NOTIFICATION_READ_KEY,
    mutationFn: (id: string) =>
      unwrap(api.api.notifications({ id }).read.post()),
    onMutate: async (id: string) => {
      const wasUnread =
        qc
          .getQueryData<NotificationItem[]>(queryKeys.notifications)
          ?.some((item) => item.id === id && item.readAt === null) ?? true;
      const readAt = new Date().toISOString();
      await markListRead(qc, (items) => markItemRead(items, id, readAt));
      // At 0 there is nothing to take, so a failure must not add one back.
      const tookOne =
        wasUnread &&
        (qc.getQueryData<WithUnread>(queryKeys.home)?.unreadCount ?? 0) > 0;
      if (tookOne) {
        updateHomeUnread(qc, withOneRead);
      }
      return { readAt, tookOne };
    },
    onError: (_error, id, context) => {
      if (context) {
        undoRead(
          qc,
          [id],
          context.readAt,
          context.tookOne ? withOneUnread : null
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
