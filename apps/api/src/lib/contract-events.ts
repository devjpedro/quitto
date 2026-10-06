export const EVENTS_PAGE = 50;
/** The raw events the contract brings: the web groups the repeated ones and shows 3 lines (planner's decision 9). */
export const RECENT_EVENTS = 20;

export interface EventRow {
  actorName: string | null;
  actorUserId: string | null;
  createdAt: Date;
  id: string;
  installmentId: string | null;
  installmentSequence: number | null;
  metadata: unknown;
  type: string;
}

export interface ContractEvent {
  actorName: string | null;
  createdAt: string;
  id: string;
  installmentId: string | null;
  installmentSequence: number | null;
  isMe: boolean;
  metadata: Record<string, unknown> | null;
  type: string;
}

export function toContractEvent(
  row: EventRow,
  viewerId: string
): ContractEvent {
  return {
    id: row.id,
    type: row.type,
    installmentId: row.installmentId,
    installmentSequence: row.installmentSequence,
    actorName: row.actorName,
    isMe: row.actorUserId !== null && row.actorUserId === viewerId,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The contract's creation, as the history's first event (no audit row for it). */
export function createdEvent(
  c: { createdAt: Date; id: string; ownerId: string },
  ownerName: string | null,
  viewerId: string
): ContractEvent {
  return {
    id: `created:${c.id}`,
    type: "contract_created",
    installmentId: null,
    installmentSequence: null,
    actorName: ownerName,
    isMe: c.ownerId === viewerId,
    metadata: null,
    createdAt: c.createdAt.toISOString(),
  };
}

/** "<createdAt ISO>|<id>": the id breaks ties between events of the same instant (review M1). */
export function cursorOf(e: { createdAt: string; id: string }): string {
  return `${e.createdAt}|${e.id}`;
}

const CURSOR_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CURSOR_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** null unless both halves are what Postgres accepts (an exact ISO date and a uuid), so a bad cursor is a 422, never a failed query. */
export function parseCursor(cursor: string): { at: string; id: string } | null {
  const [at, id] = cursor.split("|");
  return at && id && CURSOR_AT.test(at) && CURSOR_ID.test(id)
    ? { at, id }
    : null;
}

/**
 * One page of the history, newest first. `rows` was read with `limit + 1`:
 * the extra row only says there is more. The last page ends with the
 * contract's creation.
 */
export function eventsPage(
  rows: EventRow[],
  limit: number,
  created: ContractEvent,
  viewerId: string
): { items: ContractEvent[]; nextBefore: string | null } {
  if (rows.length > limit) {
    const items = rows.slice(0, limit).map((r) => toContractEvent(r, viewerId));
    const last = items.at(-1);
    return { items, nextBefore: last ? cursorOf(last) : null };
  }
  return {
    items: [...rows.map((r) => toContractEvent(r, viewerId)), created],
    nextBefore: null,
  };
}
