/** Unread count after reading one, never below zero. Structural, so it fits the cached home. */
export function withOneRead<T extends { unreadCount: number }>(value: T): T {
  return { ...value, unreadCount: Math.max(0, value.unreadCount - 1) };
}

export function withAllRead<T extends { unreadCount: number }>(value: T): T {
  return { ...value, unreadCount: 0 };
}

/** Undoes one read on the count: only that read's part, over whatever the count is now. */
export function withOneUnread<T extends { unreadCount: number }>(value: T): T {
  return { ...value, unreadCount: value.unreadCount + 1 };
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
