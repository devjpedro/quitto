/** Unread count after reading `n` (a grouped line reads them all), never below zero. */
export function withReadCount<T extends { unreadCount: number }>(
  value: T,
  n: number
): T {
  return { ...value, unreadCount: Math.max(0, value.unreadCount - n) };
}

export function withAllRead<T extends { unreadCount: number }>(value: T): T {
  return { ...value, unreadCount: 0 };
}

/** Undoes a read on the count: only that read's part, over whatever the count is now. */
export function withUnreadAdded<T extends { unreadCount: number }>(
  value: T,
  n: number
): T {
  return { ...value, unreadCount: value.unreadCount + n };
}

export function withUnreadCount<T extends { unreadCount: number }>(
  value: T,
  unreadCount: number
): T {
  return { ...value, unreadCount };
}

export function markItemRead<T extends { id: string; readAt: string | null }>(
  items: T[],
  id: string,
  readAt: string
): T[] {
  return items.map((item) =>
    item.id === id && item.readAt === null ? { ...item, readAt } : item
  );
}

export function markAllItemsRead<T extends { readAt: string | null }>(
  items: T[],
  readAt: string
): T[] {
  return items.map((item) =>
    item.readAt === null ? { ...item, readAt } : item
  );
}

/**
 * Undoes an optimistic read on the list: only the rows it marked, and only
 * while they still hold its time, so a read that succeeded meanwhile stays.
 */
export function unmarkItemsRead<
  T extends { id: string; readAt: string | null },
>(items: T[], ids: readonly string[], readAt: string): T[] {
  const marked = new Set(ids);
  return items.map((item) =>
    marked.has(item.id) && item.readAt === readAt
      ? { ...item, readAt: null }
      : item
  );
}
