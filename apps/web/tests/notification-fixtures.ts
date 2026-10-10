import type { NotificationItem } from "@/features/notifications/types";

/** One line of GET /api/notifications, a single notification unless the test says otherwise. */
export function notificationItem(
  over: Partial<NotificationItem> = {}
): NotificationItem {
  const id = over.id ?? "n1";
  const type = over.type ?? "payment_confirmed";
  const contractId = over.contractId ?? "c1";
  const readAt = over.readAt === undefined ? null : over.readAt;
  const installmentSequence =
    over.installmentSequence === undefined ? 7 : over.installmentSequence;
  return {
    id,
    type,
    contractId,
    installmentId: "i1",
    metadata: null,
    readAt,
    createdAt: "2026-10-02T10:00:00.000Z",
    contractTitle: "Aluguel do apê",
    installmentSequence,
    installmentsCount: 12,
    ids: [id],
    count: 1,
    groupKey: `${type}:${contractId}:${id}`,
    sequences: installmentSequence === null ? [] : [installmentSequence],
    unreadCount: readAt === null ? 1 : 0,
    ...over,
  };
}
