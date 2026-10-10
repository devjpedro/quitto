import { PARTICIPANT_ROLE, parsePixKey } from "@quitto/shared";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, invite, participant } from "../db/schema";
import { getContractRole } from "../lib/contract-access";
import { normalizeEmail } from "../lib/email";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../lib/errors";
import {
  inviteExpiry,
  newInviteToken,
  sendInviteEmail,
  trySendInviteEmail,
} from "../lib/invite-mail";
import { idParam } from "../lib/route-params";
import { requireAuth } from "../lib/session";

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
      // Quem acompanha sem e-mail não teria como ser convidado depois (revisão T8, I4).
      if (body.role === PARTICIPANT_ROLE.viewer && !body.email?.trim()) {
        throw new ValidationError("Quem acompanha precisa de um e-mail");
      }

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
      params: t.Object({ id: idParam }),
      body: t.Object({
        displayName: t.String({ minLength: 1, maxLength: 120 }),
        role: roleSchema,
        // Só confere quem acompanha; o convite em si vai por /invite.
        email: t.Optional(t.Union([t.String({ format: "email" }), t.Null()])),
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
      params: t.Object({ id: idParam, participantId: idParam }),
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
      params: t.Object({ id: idParam, participantId: idParam }),
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

      const token = newInviteToken();
      const expiresAt = inviteExpiry();
      await db.insert(invite).values({
        contractId: params.id,
        participantId: params.participantId,
        email: normalizeEmail(body.email),
        token,
        expiresAt,
      });

      const [c] = await db
        .select({ title: contract.title })
        .from(contract)
        .where(eq(contract.id, params.id))
        .limit(1);
      // Best-effort: a mail failure must not orphan the invite — the owner
      // still gets the token (copy-link fallback) and can resend.
      await trySendInviteEmail({
        email: normalizeEmail(body.email),
        token,
        inviterId: user.id,
        inviterName: user.name ?? "",
        contractId: params.id,
        contractTitle: c?.title ?? "",
        role: target.role,
      });

      return { token, expiresAt: expiresAt.toISOString() };
    },
    {
      params: t.Object({ id: idParam, participantId: idParam }),
      body: t.Object({
        email: t.String({ format: "email", minLength: 3, maxLength: 200 }),
      }),
      response: t.Object({ token: t.String(), expiresAt: t.String() }),
    }
  )
  .post(
    "/contracts/:id/participants/:participantId/invite/resend",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      await requireOwner(user.id, params.id);

      const [pending] = await db
        .select()
        .from(invite)
        .where(
          and(
            eq(invite.contractId, params.id),
            eq(invite.participantId, params.participantId),
            isNull(invite.acceptedAt),
            isNull(invite.declinedAt)
          )
        )
        .orderBy(desc(invite.createdAt))
        .limit(1);
      if (!pending) {
        throw new NotFoundError("Nenhum convite pendente para reenviar");
      }

      const [target] = await db
        .select({
          linkedUserId: participant.linkedUserId,
          role: participant.role,
        })
        .from(participant)
        .where(
          and(
            eq(participant.id, params.participantId),
            eq(participant.contractId, params.id)
          )
        )
        .limit(1);
      // A copy of an invite whose slot another copy already filled: nothing to resend.
      if (target?.linkedUserId) {
        throw new ConflictError("Esta vaga já foi preenchida");
      }

      // Owner's decision 15: the same invite, the same link, a fresh deadline.
      const expiresAt = inviteExpiry();
      await db
        .update(invite)
        .set({ expiresAt })
        .where(eq(invite.id, pending.id));

      const [c] = await db
        .select({ title: contract.title })
        .from(contract)
        .where(eq(contract.id, params.id))
        .limit(1);

      await sendInviteEmail({
        email: pending.email,
        token: pending.token,
        inviterId: user.id,
        inviterName: user.name ?? "",
        contractId: params.id,
        contractTitle: c?.title ?? "",
        role: target?.role ?? "viewer",
      });

      return { token: pending.token, expiresAt: expiresAt.toISOString() };
    },
    {
      params: t.Object({ id: idParam, participantId: idParam }),
      response: t.Object({ token: t.String(), expiresAt: t.String() }),
    }
  )
  .patch(
    "/contracts/:id/participants/:participantId/pix-key",
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
      if (target.role !== PARTICIPANT_ROLE.seller) {
        throw new ValidationError("Só a chave de quem recebe fica no contato");
      }
      if (target.linkedUserId) {
        throw new ValidationError("Com conta, vale a chave da conta");
      }
      let pixKey: string | null = null;
      if (body.pixKey && body.pixKey.trim() !== "") {
        try {
          pixKey = parsePixKey(body.pixKey).value;
        } catch (e) {
          throw new ValidationError((e as Error).message);
        }
      }
      await db
        .update(participant)
        .set({ pixKey })
        .where(eq(participant.id, target.id));
      return { id: target.id, pixKey };
    },
    {
      params: t.Object({ id: idParam, participantId: idParam }),
      body: t.Object({
        pixKey: t.Union([t.String({ maxLength: 140 }), t.Null()]),
      }),
      response: t.Object({
        id: t.String(),
        pixKey: t.Union([t.String(), t.Null()]),
      }),
    }
  );
