import { randomBytes } from "node:crypto";
import { PARTICIPANT_ROLE } from "@quitto/shared";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { invite, participant } from "../db/schema";
import { getContractRole } from "../lib/contract-access";
import { normalizeEmail } from "../lib/email";
import { ForbiddenError, NotFoundError } from "../lib/errors";
import { requireAuth } from "../lib/session";

const INVITE_TTL_DAYS = 7;

// Explicit literal union — mapping over an array widens to TSchema[], which breaks Eden inference.
const roleSchema = t.Union([
  t.Literal(PARTICIPANT_ROLE.buyer),
  t.Literal(PARTICIPANT_ROLE.seller),
  t.Literal(PARTICIPANT_ROLE.viewer),
]);

async function requireOwner(userId: string, contractId: string) {
  const role = await getContractRole(userId, contractId); // 404 se sem acesso
  if (role !== PARTICIPANT_ROLE.owner) {
    throw new ForbiddenError("Apenas o dono gerencia participantes");
  }
}

export const participantsModule = new Elysia({ prefix: "/api" })
  .post(
    "/contracts/:id/participants",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      await requireOwner(user.id, params.id);
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
