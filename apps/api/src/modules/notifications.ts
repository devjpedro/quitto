import { and, count, desc, eq, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { notification } from "../db/schema";
import { NotFoundError } from "../lib/errors";
import { requireAuth } from "../lib/session";

const LIST_LIMIT = 50;

export const notificationsModule = new Elysia({ prefix: "/api" })
  .get(
    "/notifications",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);
      const rows = await db
        .select()
        .from(notification)
        .where(eq(notification.userId, user.id))
        .orderBy(desc(notification.createdAt))
        .limit(LIST_LIMIT);
      return rows.map((r) => ({
        id: r.id,
        type: r.type,
        contractId: r.contractId,
        installmentId: r.installmentId,
        metadata: r.metadata as Record<string, unknown> | null,
        readAt: r.readAt ? r.readAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      }));
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
          and(eq(notification.userId, user.id), isNull(notification.readAt))
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
          and(eq(notification.userId, user.id), isNull(notification.readAt))
        );
      return { ok: true as const };
    },
    { response: t.Object({ ok: t.Literal(true) }) }
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
