import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, invite, participant } from "../db/schema";
import { normalizeEmail } from "../lib/email";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";
import { requireAuth } from "../lib/session";

async function loadValidInvite(token: string) {
  const [row] = await db
    .select()
    .from(invite)
    .where(eq(invite.token, token))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Convite não encontrado");
  }
  if (row.acceptedAt) {
    throw new ValidationError("Convite já utilizado");
  }
  if (row.expiresAt.getTime() < Date.now()) {
    throw new ValidationError("Convite expirado");
  }
  return row;
}

export const invitesModule = new Elysia({ prefix: "/api" })
  .get(
    "/invites/mine",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);
      const email = normalizeEmail(user.email);
      const rows = await db
        .select({
          token: invite.token,
          contractTitle: contract.title,
          role: participant.role,
          expiresAt: invite.expiresAt,
        })
        .from(invite)
        .innerJoin(contract, eq(invite.contractId, contract.id))
        .innerJoin(participant, eq(invite.participantId, participant.id))
        .where(
          and(
            eq(invite.email, email),
            isNull(invite.acceptedAt),
            gt(invite.expiresAt, new Date())
          )
        )
        .orderBy(desc(invite.createdAt));
      return rows.map((r) => ({
        token: r.token,
        contractTitle: r.contractTitle,
        role: r.role,
        expiresAt: r.expiresAt.toISOString(),
      }));
    },
    {
      response: t.Array(
        t.Object({
          token: t.String(),
          contractTitle: t.String(),
          role: t.String(),
          expiresAt: t.String(),
        })
      ),
    }
  )
  .get(
    "/invites/:token",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const row = await loadValidInvite(params.token);
      const [c] = await db
        .select()
        .from(contract)
        .where(eq(contract.id, row.contractId))
        .limit(1);
      if (!c) {
        throw new NotFoundError("Contrato não encontrado");
      }
      const [p] = await db
        .select()
        .from(participant)
        .where(eq(participant.id, row.participantId))
        .limit(1);
      if (!p) {
        throw new NotFoundError("Participante não encontrado");
      }
      return {
        contractTitle: c.title,
        role: p.role,
        email: row.email,
        emailMatches: normalizeEmail(user.email) === row.email,
      };
    },
    {
      params: t.Object({ token: t.String() }),
      response: t.Object({
        contractTitle: t.String(),
        role: t.String(),
        email: t.String(),
        emailMatches: t.Boolean(),
      }),
    }
  )
  .post(
    "/invites/:token/accept",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const row = await loadValidInvite(params.token);
      if (normalizeEmail(user.email) !== row.email) {
        throw new ForbiddenError("Este convite é para outro e-mail");
      }
      const contractId = await db.transaction(async (tx) => {
        await tx
          .update(participant)
          .set({ linkedUserId: user.id })
          .where(eq(participant.id, row.participantId));
        await tx
          .update(invite)
          .set({ acceptedByUserId: user.id, acceptedAt: new Date() })
          .where(eq(invite.id, row.id));
        return row.contractId;
      });
      return { contractId };
    },
    {
      params: t.Object({ token: t.String() }),
      response: t.Object({ contractId: t.String() }),
    }
  );
