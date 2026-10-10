/**
 * Postgres takes at most 65535 bind parameters per statement. A bulk insert or
 * an IN list that spans the whole database (the reminder sweep) is split into
 * statements of this many rows: a notification row binds 6, an id binds 1.
 */
export const STATEMENT_BATCH = 1000;

/** `items` in consecutive slices of at most `size`. */
export function batches<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let at = 0; at < items.length; at += size) {
    out.push(items.slice(at, at + size));
  }
  return out;
}

/** `run` once per slice of `items`, one after the other, with the rows joined. */
export async function inBatches<T, R>(
  items: readonly T[],
  size: number,
  run: (slice: T[]) => Promise<R[]>
): Promise<R[]> {
  const out: R[] = [];
  for (const slice of batches(items, size)) {
    out.push(...(await run(slice)));
  }
  return out;
}
