import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const UNREAD_POLL_MS = 60_000;

export const notificationsQueryOptions = queryOptions({
  queryKey: queryKeys.notifications,
  queryFn: () => unwrap(api.api.notifications.get()),
});

export const unreadCountQueryOptions = queryOptions({
  queryKey: queryKeys.notificationsUnread,
  queryFn: () => unwrap(api.api.notifications["unread-count"].get()),
  refetchInterval: UNREAD_POLL_MS,
});

export function useNotificationsQuery() {
  return useQuery(notificationsQueryOptions);
}

export function useUnreadCountQuery() {
  return useQuery(unreadCountQueryOptions);
}

function useInvalidateNotifications() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.notifications });
    qc.invalidateQueries({ queryKey: queryKeys.notificationsUnread });
  };
}

export function useMarkReadMutation() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.api.notifications({ id }).read.post()),
    onSuccess: invalidate,
  });
}

export function useMarkAllReadMutation() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => unwrap(api.api.notifications["read-all"].post()),
    onSuccess: invalidate,
  });
}
