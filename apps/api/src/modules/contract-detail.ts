import { todayISO } from "@quitto/shared";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import {
  auditEvent,
  contract,
  installment,
  invite,
  participant,
  user as userTable,
} from "../db/schema";
import { env } from "../env";
import {
  getCapabilities,
  getContractRole,
  pickRecebedor,
  receiverContactId,
} from "../lib/contract-access";
import {
  createdEvent,
  EVENTS_PAGE,
  eventsPage,
  parseCursor,
  RECENT_EVENTS,
} from "../lib/contract-events";
import { peopleView } from "../lib/contract-people";
import { computeProgress } from "../lib/contract-progress";
import { NotFoundError, ValidationError } from "../lib/errors";
import { usableKey } from "../lib/installment-pix";
import { requireAuth } from "../lib/session";

async function loadContract(id: string) {
  const [c] = await db
    .select()
    .from(contract)
    .where(eq(contract.id, id))
    .limit(1);
  if (!c) {
    throw new NotFoundError("Contrato não encontrado");
  }
  return c;
}

/**
 * The history's order key, cut to the millisecond: the cursor travels as an
 * ISO string (milliseconds), while `now()` stores microseconds; comparing the
 * raw column would skip events inside the cursor's millisecond (review M1).
 */
const createdMs = sql`date_trunc('milliseconds', ${auditEvent.createdAt})`;

function loadEvents(
  contractId: string,
  limit: number,
  before?: { at: string; id: string } | null
) {
  // The ISO string ends in "Z"; cast to a timestamp without time zone, Postgres
  // ignores the zone, which matches how drizzle stores these columns (UTC).
  const at = before ? sql`${before.at}::timestamp` : null;
  return db
    .select({
      id: auditEvent.id,
      type: auditEvent.type,
      installmentId: auditEvent.installmentId,
      installmentSequence: installment.sequence,
      actorUserId: auditEvent.actorUserId,
      actorName: userTable.name,
      metadata: auditEvent.metadata,
      createdAt: auditEvent.createdAt,
    })
    .from(auditEvent)
    .leftJoin(userTable, eq(auditEvent.actorUserId, userTable.id))
    .leftJoin(installment, eq(auditEvent.installmentId, installment.id))
    .where(
      and(
        eq(auditEvent.contractId, contractId),
        before && at
          ? or(
              lt(createdMs, at),
              and(eq(createdMs, at), lt(auditEvent.id, before.id))
            )
          : undefined
      )
    )
    .orderBy(desc(createdMs), desc(auditEvent.id))
    .limit(limit);
}

const eventSchema = t.Object({
  id: t.String(),
  type: t.String(),
  installmentId: t.Union([t.String(), t.Null()]),
  installmentSequence: t.Union([t.Integer(), t.Null()]),
  actorName: t.Union([t.String(), t.Null()]),
  isMe: t.Boolean(),
  metadata: t.Union([t.Record(t.String(), t.Unknown()), t.Null()]),
  createdAt: t.String(),
});

const pixSchema = t.Union([
  t.Object({
    key: t.String(),
    keyType: t.String(),
    source: t.Union([t.Literal("account"), t.Literal("contact")]),
  }),
  t.Null(),
]);

const inviteSchema = t.Union([
  t.Object({
    status: t.Union([
      t.Literal("pending"),
      t.Literal("expired"),
      t.Literal("declined"),
    ]),
    sentAt: t.String(),
    url: t.Union([t.String(), t.Null()]),
  }),
  t.Null(),
]);

export const contractDetailModule = new Elysia({ prefix: "/api" })
  .get(
    "/contracts/:id",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const access = await getCapabilities(user.id, params.id); // 404 without access
      const c = await loadContract(params.id);
      const [items, people, invites, eventRows] = await Promise.all([
        db
          .select()
          .from(installment)
          .where(eq(installment.contractId, params.id)),
        db
          .select({
            id: participant.id,
            displayName: participant.displayName,
            role: participant.role,
            linkedUserId: participant.linkedUserId,
            pixKey: participant.pixKey,
            createdAt: participant.createdAt,
          })
          .from(participant)
          .where(eq(participant.contractId, params.id)),
        db
          .select({
            participantId: invite.participantId,
            email: invite.email,
            token: invite.token,
            createdAt: invite.createdAt,
            expiresAt: invite.expiresAt,
            acceptedAt: invite.acceptedAt,
            declinedAt: invite.declinedAt,
          })
          .from(invite)
          .where(eq(invite.contractId, params.id)),
        loadEvents(params.id, RECENT_EVENTS + 1),
      ]);
      const userIds = [
        ...new Set([
          c.ownerId,
          ...people.flatMap((p) => (p.linkedUserId ? [p.linkedUserId] : [])),
        ]),
      ];
      const users = await db
        .select({
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
          pixKey: userTable.pixKey,
        })
        .from(userTable)
        .where(inArray(userTable.id, userIds));
      const usersById = new Map(users.map((u) => [u.id, u]));
      const recebedor = pickRecebedor(c, people, usersById);
      const ownerName = usersById.get(c.ownerId)?.name ?? null;
      const progress = computeProgress(items, todayISO());

      return {
        role: access.role,
        isOwner: access.isOwner,
        isPayer: access.isPayer,
        isApprover: access.isApprover,
        contract: {
          id: c.id,
          title: c.title,
          description: c.description,
          ownerRole: c.ownerRole,
          requiresConfirmation: c.requiresConfirmation,
          status: c.status,
          monthlyAmountCents: c.monthlyAmountCents,
          pixKey: c.pixKey,
          // Legacy until Fase 6: the web now reads `receiver`.
          recebedor:
            recebedor.displayName === null && recebedor.key === null
              ? null
              : { name: recebedor.displayName, hasKey: recebedor.key !== null },
          createdAt: c.createdAt.toISOString(),
          ownerName,
        },
        receiver: {
          name: recebedor.displayName,
          hasAccount: recebedor.hasAccount,
          contactParticipantId: receiverContactId(c, people),
          pix: access.role === "viewer" ? null : usableKey(recebedor),
        },
        progress: {
          totalCents: progress.totalCents,
          paidCents: progress.paidCents,
          remainingCents: progress.remainingCents,
          percent: progress.percent,
          overdueCount: progress.overdueCount,
        },
        installments: items
          .sort((a, b) => a.sequence - b.sequence)
          .map((it) => ({
            id: it.id,
            sequence: it.sequence,
            amountCents: it.amountCents,
            dueDate: it.dueDate,
            status: it.status,
            paidAt: it.paidAt?.toISOString() ?? null,
          })),
        participants: peopleView({
          people,
          invites,
          emails: new Map(users.map((u) => [u.id, u.email])),
          ownerId: c.ownerId,
          contractCreatedAt: c.createdAt,
          viewerId: user.id,
          now: new Date(),
          webOrigin: env.WEB_ORIGIN,
        }),
        recentEvents: eventsPage(
          eventRows,
          RECENT_EVENTS,
          createdEvent(c, ownerName, user.id),
          user.id
        ).items,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      response: t.Object({
        role: t.String(),
        isOwner: t.Boolean(),
        isPayer: t.Boolean(),
        isApprover: t.Boolean(),
        contract: t.Object({
          id: t.String(),
          title: t.String(),
          description: t.Union([t.String(), t.Null()]),
          ownerRole: t.String(),
          requiresConfirmation: t.Boolean(),
          status: t.String(),
          monthlyAmountCents: t.Union([t.Integer(), t.Null()]),
          pixKey: t.Union([t.String(), t.Null()]),
          recebedor: t.Union([
            t.Object({
              name: t.Union([t.String(), t.Null()]),
              hasKey: t.Boolean(),
            }),
            t.Null(),
          ]),
          createdAt: t.String(),
          ownerName: t.Union([t.String(), t.Null()]),
        }),
        receiver: t.Object({
          name: t.Union([t.String(), t.Null()]),
          hasAccount: t.Boolean(),
          contactParticipantId: t.Union([t.String(), t.Null()]),
          pix: pixSchema,
        }),
        progress: t.Object({
          totalCents: t.Integer(),
          paidCents: t.Integer(),
          remainingCents: t.Integer(),
          percent: t.Integer(),
          overdueCount: t.Integer(),
        }),
        installments: t.Array(
          t.Object({
            id: t.String(),
            sequence: t.Integer(),
            amountCents: t.Integer(),
            dueDate: t.String(),
            status: t.String(),
            paidAt: t.Union([t.String(), t.Null()]),
          })
        ),
        participants: t.Array(
          t.Object({
            id: t.String(),
            displayName: t.String(),
            role: t.String(),
            linked: t.Boolean(),
            isOwner: t.Boolean(),
            isMe: t.Boolean(),
            email: t.Union([t.String(), t.Null()]),
            invite: inviteSchema,
            joinedAt: t.Union([t.String(), t.Null()]),
          })
        ),
        recentEvents: t.Array(eventSchema),
      }),
    }
  )
  .get(
    "/contracts/:id/events",
    async ({ request, params, query }) => {
      const { user } = await requireAuth(request.headers);
      await getContractRole(user.id, params.id); // 404 without access
      const c = await loadContract(params.id);
      const [owner] = await db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, c.ownerId))
        .limit(1);
      const before = query.before ? parseCursor(query.before) : null;
      if (query.before && !before) {
        throw new ValidationError("Cursor inválido");
      }
      const rows = await loadEvents(params.id, EVENTS_PAGE + 1, before);
      return eventsPage(
        rows,
        EVENTS_PAGE,
        createdEvent(c, owner?.name ?? null, user.id),
        user.id
      );
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ before: t.Optional(t.String({ maxLength: 120 })) }),
      response: t.Object({
        items: t.Array(eventSchema),
        nextBefore: t.Union([t.String(), t.Null()]),
      }),
    }
  );
