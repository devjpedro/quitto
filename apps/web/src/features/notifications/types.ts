import type { api } from "@/lib/api";

type ListResponse = Awaited<ReturnType<typeof api.api.notifications.get>>;

/** One item of GET /api/notifications (with contract title and installment, Task 5). */
export type NotificationItem = NonNullable<ListResponse["data"]>[number];
