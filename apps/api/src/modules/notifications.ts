import { and, count, desc, eq, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, installment, notification } from "../db/schema";
import { NotFoundError } from "../lib/errors";
import { requireAuth } from "../lib/session";

const LIST_LIMIT = 50;

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
        contractTitle: r.contractTitle,
        installmentsCount: r.installmentsCount,
        installmentSequence: r.installmentSequence ?? null,
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
          contractTitle: t.String(),
          installmentsCount: t.Integer(),
          installmentSequence: t.Union([t.Integer(), t.Null()]),
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
