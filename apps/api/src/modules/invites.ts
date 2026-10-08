import { AUDIT_TYPE, NOTIFICATION_TYPE } from "@quitto/shared";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, invite, participant } from "../db/schema";
import { recordEvent } from "../lib/audit";
import { normalizeEmail } from "../lib/email";
import {
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  ValidationError,
} from "../lib/errors";
import {
  findInvite,
  inviteViewFor,
  publicPreviewFor,
} from "../lib/invite-load";
import { createNotifications } from "../lib/notifications";
import { PUBLIC_HEADERS } from "../lib/public-headers";
import {
  clientIp,
  createRateLimiter,
  INVITE_PREVIEW_GLOBAL,
  INVITE_PREVIEW_LIMIT,
  rateLimitOn,
} from "../lib/rate-limit";
import { requireAuth } from "../lib/session";
import { inviteViewSchema, publicInvitePreviewSchema } from "./invite-schema";

const previewLimiter = createRateLimiter(INVITE_PREVIEW_LIMIT);
const previewGlobal = createRateLimiter(INVITE_PREVIEW_GLOBAL);

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
  if (row.declinedAt) {
    throw new ValidationError("Convite já recusado");
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
            isNull(invite.declinedAt),
            isNull(participant.linkedUserId),
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
      const row = await findInvite(params.token);
      if (!row) {
        throw new NotFoundError("Convite não encontrado");
      }
      // Every state answers 200 with its status (planner's decision 11);
      // accept and decline keep refusing what they cannot do.
      return await inviteViewFor(row, user);
    },
    { params: t.Object({ token: t.String() }), response: inviteViewSchema }
  )
  .get(
    "/invites/:token/preview",
    async ({ request, params, server, set }) => {
      Object.assign(set.headers, PUBLIC_HEADERS);
      const ip = clientIp(request, server?.requestIP(request)?.address);
      // The connection's own limit first: what it sends past it never
      // reaches the global cap, so one abusive connection cannot spend
      // everyone's budget (coordinator's call on the brief's order).
      if (
        rateLimitOn() &&
        !(previewLimiter.hit(ip) && previewGlobal.hit("all"))
      ) {
        throw new RateLimitedError();
      }
      const row = await findInvite(params.token);
      if (!row) {
        throw new NotFoundError("Convite não encontrado");
      }
      return await publicPreviewFor(row);
    },
    {
      params: t.Object({ token: t.String() }),
      response: publicInvitePreviewSchema,
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
        // slot must not already be linked (double-accept / race)
        const [slot] = await tx
          .select({
            linkedUserId: participant.linkedUserId,
            displayName: participant.displayName,
            role: participant.role,
          })
          .from(participant)
          .where(eq(participant.id, row.participantId))
          .limit(1);
        if (slot?.linkedUserId) {
          throw new ValidationError("Esta vaga já foi vinculada");
        }
        // accepting user must not already participate in this contract (covers the
        // owner, whose own slot is linked to ownerId)
        const [existing] = await tx
          .select({ id: participant.id })
          .from(participant)
          .where(
            and(
              eq(participant.contractId, row.contractId),
              eq(participant.linkedUserId, user.id)
            )
          )
          .limit(1);
        if (existing) {
          throw new ForbiddenError("Você já participa deste contrato");
        }
        await tx
          .update(participant)
          .set({ linkedUserId: user.id })
          .where(eq(participant.id, row.participantId));
        await recordEvent(tx, {
          contractId: row.contractId,
          actorUserId: user.id,
          type: AUDIT_TYPE.participantJoined,
          metadata: slot
            ? { participantName: slot.displayName, role: slot.role }
            : undefined,
        });
        await tx
          .update(invite)
          .set({ acceptedByUserId: user.id, acceptedAt: new Date() })
          .where(eq(invite.id, row.id));
        const [c2] = await tx
          .select({ ownerId: contract.ownerId })
          .from(contract)
          .where(eq(contract.id, row.contractId))
          .limit(1);
        if (c2 && c2.ownerId !== user.id) {
          await createNotifications(tx, [
            {
              userId: c2.ownerId,
              type: NOTIFICATION_TYPE.inviteAccepted,
              contractId: row.contractId,
              metadata: { email: row.email },
            },
          ]);
        }
        return row.contractId;
      });
      return { contractId };
    },
    {
      params: t.Object({ token: t.String() }),
      response: t.Object({ contractId: t.String() }),
    }
  )
  .post(
    "/invites/:token/decline",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const row = await loadValidInvite(params.token);
      if (normalizeEmail(user.email) !== row.email) {
        throw new ForbiddenError("Este convite é para outro e-mail");
      }
      const [c] = await db
        .select({ ownerId: contract.ownerId })
        .from(contract)
        .where(eq(contract.id, row.contractId))
        .limit(1);
      await db.transaction(async (tx) => {
        // Decline every pending invite of this slot for this e-mail, so a
        // duplicate sent earlier doesn't come back as an action.
        await tx
          .update(invite)
          .set({ declinedAt: new Date() })
          .where(
            and(
              eq(invite.participantId, row.participantId),
              eq(invite.email, row.email),
              isNull(invite.acceptedAt),
              isNull(invite.declinedAt)
            )
          );
        if (c) {
          await createNotifications(tx, [
            {
              userId: c.ownerId,
              type: NOTIFICATION_TYPE.inviteDeclined,
              contractId: row.contractId,
              metadata: { email: row.email },
            },
          ]);
        }
      });
      const fresh = await findInvite(params.token);
      if (!fresh) {
        throw new NotFoundError("Convite não encontrado");
      }
      return await inviteViewFor(fresh, user);
    },
    {
      params: t.Object({ token: t.String() }),
      response: inviteViewSchema,
    }
  );
