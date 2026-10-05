import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, installment, notification } from "../db/schema";
import { visibleNotificationsWhere } from "../lib/contract-visibility";
import { NotFoundError } from "../lib/errors";
import { groupNotifications, RAW_LIMIT } from "../lib/notification-groups";
import { requireAuth } from "../lib/session";

export const notificationsModule = new Elysia({ prefix: "/api" })
  .get(
    "/notifications",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);
      const rows = await db
        .select({
          id: notification.id,
          type: notification.type,
          contractId: notification.contractId,
          installmentId: notification.installmentId,
          metadata: notification.metadata,
          readAt: notification.readAt,
          createdAt: notification.createdAt,
          contractTitle: contract.title,
          installmentsCount: contract.installmentsCount,
          installmentSequence: installment.sequence,
        })
        .from(notification)
        .innerJoin(contract, eq(notification.contractId, contract.id))
        .leftJoin(installment, eq(notification.installmentId, installment.id))
        .where(visibleNotificationsWhere(user.id))
        // Ties (one cron sweep writes all at the same instant) keep the same
        // contract and type together, and the order stable across reads.
        .orderBy(
          desc(notification.createdAt),
          notification.contractId,
          notification.type,
          desc(notification.id)
        )
        .limit(RAW_LIMIT);
      return groupNotifications(
        rows.map((r) => ({
          id: r.id,
          type: r.type,
          contractId: r.contractId,
          installmentId: r.installmentId,
          metadata: r.metadata as Record<string, unknown> | null,
          readAt: r.readAt,
          createdAt: r.createdAt,
          contractTitle: r.contractTitle,
          installmentsCount: r.installmentsCount,
          installmentSequence: r.installmentSequence ?? null,
        }))
      );
    },
    {
      response: t.Array(
        t.Object({
          id: t.String(),
          type: t.String(),
          contractId: t.String(),
          installmentId: t.Union([t.String(), t.Null()]),
          metadata: t.Union([t.Record(t.String(), t.Unknown()), t.Null()]),
          readAt: t.Union([t.String(), t.Null()]),
          createdAt: t.String(),
          contractTitle: t.String(),
          installmentsCount: t.Integer(),
          installmentSequence: t.Union([t.Integer(), t.Null()]),
          ids: t.Array(t.String()),
          count: t.Integer(),
          groupKey: t.String(),
          sequences: t.Array(t.Integer()),
          unreadCount: t.Integer(),
        })
      ),
    }
  )
  .get(
    "/notifications/unread-count",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);
      const [row] = await db
        .select({ value: count() })
        .from(notification)
        .where(
          and(visibleNotificationsWhere(user.id), isNull(notification.readAt))
        );
      return { count: row?.value ?? 0 };
    },
    { response: t.Object({ count: t.Integer() }) }
  )
  .post(
    "/notifications/read-all",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);
      await db
        .update(notification)
        .set({ readAt: new Date() })
        .where(
          and(visibleNotificationsWhere(user.id), isNull(notification.readAt))
        );
      return { ok: true as const };
    },
    { response: t.Object({ ok: t.Literal(true) }) }
  )
  .post(
    "/notifications/read",
    async ({ request, body }) => {
      const { user } = await requireAuth(request.headers);
      // A grouped line reads every notification behind it, the user's own
      // and still visible only (the same rule as the list and the counts).
      const mine = and(
        inArray(notification.id, body.ids),
        visibleNotificationsWhere(user.id)
      );
      // Only the unread ones change: `count` is how many this call read, and
      // a notification already read keeps its readAt.
      const updated = await db
        .update(notification)
        .set({ readAt: new Date() })
        .where(and(mine, isNull(notification.readAt)))
        .returning({ id: notification.id });
      if (updated.length === 0) {
        // Reading a line again is fine (count 0); ids none of which are the
        // user's are not.
        const [own] = await db
          .select({ id: notification.id })
          .from(notification)
          .where(mine)
          .limit(1);
        if (!own) {
          throw new NotFoundError("Notificação não encontrada");
        }
      }
      return { ok: true as const, count: updated.length };
    },
    {
      body: t.Object({
        ids: t.Array(t.String({ format: "uuid" }), {
          minItems: 1,
          maxItems: RAW_LIMIT,
        }),
      }),
      response: t.Object({ ok: t.Literal(true), count: t.Integer() }),
    }
  )
  .post(
    "/notifications/:id/read",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const updated = await db
        .update(notification)
        .set({ readAt: new Date() })
        .where(
          and(eq(notification.id, params.id), eq(notification.userId, user.id))
        )
        .returning({ id: notification.id });
      if (updated.length === 0) {
        throw new NotFoundError("Notificação não encontrada");
      }
      return { ok: true as const };
    },
    {
      params: t.Object({ id: t.String() }),
      response: t.Object({ ok: t.Literal(true) }),
    }
  );
