/** Raw notifications read per request: enough for 50 lines even when a run has dozens. */
export const RAW_LIMIT = 200;
export const GROUP_LIMIT = 50;

/** A notification as read from the database, with its contract and installment. */
export interface NotificationRow {
  contractId: string;
  contractTitle: string;
  createdAt: Date;
  id: string;
  installmentId: string | null;
  installmentSequence: number | null;
  installmentsCount: number;
  metadata: Record<string, unknown> | null;
  readAt: Date | null;
  type: string;
}

/** One line of the list: the newest notification's fields, plus the run behind it. */
export interface NotificationGroup {
  contractId: string;
  contractTitle: string;
  count: number;
  createdAt: string;
  groupKey: string;
  id: string;
  ids: string[];
  installmentId: string | null;
  installmentSequence: number | null;
  installmentsCount: number;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  sequences: number[];
  type: string;
  unreadCount: number;
}

function toGroup(members: NotificationRow[]): NotificationGroup {
  const [newest] = members as [NotificationRow, ...NotificationRow[]];
  const oldest = members.at(-1) as NotificationRow;
  const unreadCount = members.filter((m) => m.readAt === null).length;
  const readTimes = members.flatMap((m) =>
    m.readAt === null ? [] : [m.readAt.getTime()]
  );
  const sequences = [
    ...new Set(
      members.flatMap((m) =>
        m.installmentSequence === null ? [] : [m.installmentSequence]
      )
    ),
  ].sort((a, b) => a - b);
  return {
    id: newest.id,
    ids: members.map((m) => m.id),
    count: members.length,
    // Stable while the run grows: a newer notice changes `id`, not the oldest one.
    groupKey: `${newest.type}:${newest.contractId}:${oldest.id}`,
    type: newest.type,
    contractId: newest.contractId,
    contractTitle: newest.contractTitle,
    installmentsCount: newest.installmentsCount,
    installmentId: newest.installmentId,
    installmentSequence: newest.installmentSequence,
    metadata: newest.metadata,
    sequences,
    unreadCount,
    readAt:
      unreadCount > 0 ? null : new Date(Math.max(...readTimes)).toISOString(),
    createdAt: newest.createdAt.toISOString(),
  };
}

/**
 * Notifications in a row (newest first) of the same type on the same
 * contract are one line (DIRECAO › "Agrupe o que se repete"): "24 parcelas a
 * receber estão vencidas", with the count on the icon tile. A different
 * notification in between starts a new line. A line is unread while any of
 * its notifications is, and reading it reads them all (POST
 * /notifications/read). The limit counts lines, not notifications.
 *
 * The rows are a window of at most RAW_LIMIT notifications. When the read
 * hits that limit, the last line may be partial: its run can go on past the
 * window, so its `count`, `ids` and `unreadCount` fall short, and its
 * `groupKey` changes as newer notifications push the oldest one out. Every
 * line before it is complete.
 */
export function groupNotifications(
  rows: NotificationRow[],
  limit = GROUP_LIMIT
): NotificationGroup[] {
  const runs: NotificationRow[][] = [];
  for (const row of rows) {
    const last = runs.at(-1);
    const head = last?.[0];
    if (
      last &&
      head &&
      head.type === row.type &&
      head.contractId === row.contractId
    ) {
      last.push(row);
    } else {
      runs.push([row]);
    }
  }
  return runs.slice(0, limit).map(toGroup);
}
