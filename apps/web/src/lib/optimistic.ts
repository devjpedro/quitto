import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Applies an optimistic cache update and returns the rollback. Cancels
 * in-flight fetches first so a stale response can't overwrite the update.
 */
export async function optimisticUpdate<T>(
  client: QueryClient,
  queryKey: QueryKey,
  update: (current: T | undefined) => T | undefined
): Promise<() => void> {
  await client.cancelQueries({ queryKey });
  const previous = client.getQueryData<T>(queryKey);
  const next = update(previous);
  if (next !== undefined) {
    client.setQueryData<T>(queryKey, next);
  }
  return () => {
    client.setQueryData<T | undefined>(queryKey, previous);
  };
}
