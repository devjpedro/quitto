/** Unread count after reading one, never below zero. Structural, so it fits the cached home. */
export function withOneRead<T extends { unreadCount: number }>(value: T): T {
  return { ...value, unreadCount: Math.max(0, value.unreadCount - 1) };
}

export function withAllRead<T extends { unreadCount: number }>(value: T): T {
  return { ...value, unreadCount: 0 };
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
