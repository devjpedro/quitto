import { randomBytes } from "node:crypto";
import { PARTICIPANT_ROLE } from "@quitto/shared";
import { and, eq, ne } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { invite, participant } from "../db/schema";
import { getContractRole } from "../lib/contract-access";
import { normalizeEmail } from "../lib/email";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";
import { requireAuth } from "../lib/session";

const INVITE_TTL_DAYS = 7;

/**
 * buyer/seller são papéis únicos por contrato; viewer é ilimitado.
 * `exceptParticipantId` ignora o próprio participante (útil ao editar o papel).
 */
async function assertRoleAvailable(
  contractId: string,
  role: string,
  exceptParticipantId?: string
) {
  if (role !== PARTICIPANT_ROLE.buyer && role !== PARTICIPANT_ROLE.seller) {
    return;
  }
  const clauses = [
    eq(participant.contractId, contractId),
    eq(participant.role, role),
  ];
  if (exceptParticipantId) {
    clauses.push(ne(participant.id, exceptParticipantId));
  }
  const [taken] = await db
    .select({ id: participant.id })
    .from(participant)
    .where(and(...clauses))
    .limit(1);
  if (taken) {
    throw new ValidationError("Este papel já está ocupado");
  }
}

// Explicit literal union — mapping over an array widens to TSchema[], which breaks Eden inference.
const roleSchema = t.Union([
  t.Literal(PARTICIPANT_ROLE.buyer),
  t.Literal(PARTICIPANT_ROLE.seller),
  t.Literal(PARTICIPANT_ROLE.viewer),
]);

async function requireOwner(userId: string, contractId: string) {
  const { isOwner } = await getContractRole(userId, contractId); // 404 se sem acesso
  if (!isOwner) {
    throw new ForbiddenError("Apenas o dono gerencia participantes");
  }
}

export const participantsModule = new Elysia({ prefix: "/api" })
  .post(
    "/contracts/:id/participants",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      await requireOwner(user.id, params.id);

      await assertRoleAvailable(params.id, body.role);

      const [created] = await db
        .insert(participant)
        .values({
          contractId: params.id,
          displayName: body.displayName,
          role: body.role,
        })
        .returning({ id: participant.id });
      if (!created) {
        throw new Error("Insert did not return a row");
      }
      return { id: created.id };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        displayName: t.String({ minLength: 1, maxLength: 120 }),
        role: roleSchema,
      }),
      response: t.Object({ id: t.String() }),
    }
  )
  .delete(
    "/contracts/:id/participants/:participantId",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      await requireOwner(user.id, params.id);
      const [target] = await db
        .select()
        .from(participant)
        .where(
          and(
            eq(participant.id, params.participantId),
            eq(participant.contractId, params.id)
          )
        )
        .limit(1);
      if (!target) {
        throw new NotFoundError("Participante não encontrado");
      }
      // requireOwner já provou que user.id === contract.ownerId,
      // logo comparar com o usuário autenticado dispensa o SELECT.
      if (target.linkedUserId === user.id) {
        throw new ForbiddenError("O dono não pode ser removido");
      }
      await db
        .delete(participant)
        .where(eq(participant.id, params.participantId));
      return { ok: true as const };
    },
    {
      params: t.Object({ id: t.String(), participantId: t.String() }),
      response: t.Object({ ok: t.Literal(true) }),
    }
  )
  .patch(
    "/contracts/:id/participants/:participantId",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      await requireOwner(user.id, params.id);

      const [target] = await db
        .select()
        .from(participant)
        .where(
          and(
            eq(participant.id, params.participantId),
            eq(participant.contractId, params.id)
          )
        )
        .limit(1);
      if (!target) {
        throw new NotFoundError("Participante não encontrado");
      }

      // requireOwner provou que user.id === contract.ownerId, logo o slot do
      // dono é o participante vinculado ao usuário autenticado.
      if (
        target.linkedUserId === user.id &&
        body.role === PARTICIPANT_ROLE.viewer
      ) {
        throw new ValidationError("O dono deve ser comprador ou vendedor");
      }

      await assertRoleAvailable(params.id, body.role, params.participantId);

      await db
        .update(participant)
        .set({ role: body.role })
        .where(eq(participant.id, params.participantId));
      return { id: target.id, role: body.role };
    },
    {
      params: t.Object({ id: t.String(), participantId: t.String() }),
      body: t.Object({ role: roleSchema }),
      response: t.Object({ id: t.String(), role: roleSchema }),
    }
  )
  .post(
    "/contracts/:id/participants/:participantId/invite",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      await requireOwner(user.id, params.id);

      const [target] = await db
        .select()
        .from(participant)
        .where(
          and(
            eq(participant.id, params.participantId),
            eq(participant.contractId, params.id)
          )
        )
        .limit(1);
      if (!target) {
        throw new NotFoundError("Participante não encontrado");
      }
      if (target.linkedUserId) {
        throw new ForbiddenError("Participante já vinculado a um usuário");
      }

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(
        Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
      );
      await db.insert(invite).values({
        contractId: params.id,
        participantId: params.participantId,
        email: normalizeEmail(body.email),
        token,
        expiresAt,
      });
      return { token, expiresAt: expiresAt.toISOString() };
    },
    {
      params: t.Object({ id: t.String(), participantId: t.String() }),
      body: t.Object({
        email: t.String({ format: "email", minLength: 3, maxLength: 200 }),
      }),
      response: t.Object({ token: t.String(), expiresAt: t.String() }),
    }
  );
