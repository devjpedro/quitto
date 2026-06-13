import { PARTICIPANT_ROLE } from "@quitto/shared";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { participant } from "../db/schema";
import { getContractRole } from "../lib/contract-access";
import { ForbiddenError, NotFoundError } from "../lib/errors";
import { requireAuth } from "../lib/session";

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
      if (target.role === PARTICIPANT_ROLE.owner) {
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
  );
