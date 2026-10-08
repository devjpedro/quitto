import {
  AUDIT_TYPE,
  contractRequestSchema,
  NOTIFICATION_TYPE,
  parsePixKey,
  todayISO,
} from "@quitto/shared";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, installment, participant, proof } from "../db/schema";
import { recordEvent } from "../lib/audit";
import { getContractRole } from "../lib/contract-access";
import { contractCards } from "../lib/contract-cards";
import { createContract } from "../lib/contract-create";
import { loadContractRows } from "../lib/contract-rows";
import { normalizeEmail } from "../lib/email";
import {
  CodedError,
  codedValidationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../lib/errors";
import { trySendInviteEmail } from "../lib/invite-mail";
import { createNotifications } from "../lib/notifications";
import { idParam } from "../lib/route-params";
import { requireAuth } from "../lib/session";
import { deleteObjects } from "../lib/storage";
import { contractListItemSchema } from "./list-schemas";

// Types only, no limits (planner's decision 3): the shared zod sets the
// limits, so every mistake comes back as a code the web translates.
const InstallmentRow = t.Object({
  amountCents: t.Number(),
  dueDate: t.String(),
});

const CreateContractBody = t.Object({
  title: t.String(),
  description: t.Optional(t.String()),
  ownerRole: t.Union([t.Literal("buyer"), t.Literal("seller")]),
  requiresConfirmation: t.Boolean(),
  schedule: t.Union([
    t.Object({
      mode: t.Literal("split"),
      totalAmountCents: t.Number(),
      installmentsCount: t.Number(),
      firstDueDate: t.String(),
    }),
    t.Object({
      mode: t.Literal("monthly"),
      monthlyAmountCents: t.Number(),
      months: t.Number(),
      firstDueDate: t.String(),
    }),
    // Legacy, until phase 6.
    t.Object({
      mode: t.Literal("auto"),
      totalAmountCents: t.Number(),
      installmentsCount: t.Number(),
      firstDueDate: t.String(),
    }),
    t.Object({
      mode: t.Literal("custom"),
      installments: t.Array(InstallmentRow),
    }),
  ]),
  installments: t.Optional(t.Array(InstallmentRow)),
  counterparty: t.Optional(
    t.Object({ name: t.String(), email: t.Optional(t.String()) })
  ),
});

const CreateContractResponse = t.Object({
  id: t.String(),
  invite: t.Union([
    t.Object({ email: t.String(), sent: t.Boolean() }),
    t.Null(),
  ]),
});

export const contractsModule = new Elysia({ prefix: "/api" })
  .post(
    "/contracts",
    async ({ request, body }) => {
      const { user } = await requireAuth(request.headers);
      const parsed = contractRequestSchema.safeParse(body);
      if (!parsed.success) {
        throw codedValidationError(parsed.error.issues);
      }
      const input = parsed.data;
      const email = input.counterparty?.email;
      if (email && normalizeEmail(email) === normalizeEmail(user.email)) {
        throw new CodedError({
          code: "counterparty.email.self",
          path: "counterparty.email",
        });
      }
      const created = await createContract(
        { id: user.id, name: user.name },
        input
      );
      if (!created.invite) {
        return { id: created.id, invite: null };
      }
      const sent = await trySendInviteEmail({
        email: created.invite.email,
        token: created.invite.token,
        inviterName: user.name ?? "Alguém",
        contractTitle: input.title,
        role: created.invite.role,
      });
      return { id: created.id, invite: { email: created.invite.email, sent } };
    },
    { body: CreateContractBody, response: CreateContractResponse }
  )
  .get(
    "/contracts",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);
      const rows = await loadContractRows(user.id);
      return contractCards(user.id, rows, todayISO());
    },
    { response: t.Array(contractListItemSchema) }
  )
  .patch(
    "/contracts/:id",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      const { isOwner } = await getContractRole(user.id, params.id);
      if (!isOwner) {
        throw new ForbiddenError("Apenas o dono edita o contrato");
      }
      const patch: Partial<typeof contract.$inferInsert> = {};
      if (body.pixKey !== undefined) {
        patch.pixKey = null;
        if (body.pixKey && body.pixKey.trim() !== "") {
          try {
            patch.pixKey = parsePixKey(body.pixKey).value;
          } catch (e) {
            throw new ValidationError((e as Error).message);
          }
        }
      }
      if (body.title !== undefined) {
        patch.title = body.title.trim();
      }
      if (body.description !== undefined) {
        const text = body.description?.trim() ?? "";
        patch.description = text === "" ? null : text;
      }
      if (patch.title === "") {
        throw new ValidationError("O contrato precisa de um nome");
      }
      const [row] = await db
        .update(contract)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(contract.id, params.id))
        .returning({
          id: contract.id,
          title: contract.title,
          description: contract.description,
          pixKey: contract.pixKey,
        });
      if (!row) {
        throw new NotFoundError("Contrato não encontrado");
      }
      return row;
    },
    {
      params: t.Object({ id: idParam }),
      body: t.Object({
        pixKey: t.Optional(t.Union([t.String(), t.Null()])),
        title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        description: t.Optional(
          t.Union([t.String({ maxLength: 2000 }), t.Null()])
        ),
      }),
      response: t.Object({
        id: t.String(),
        title: t.String(),
        description: t.Union([t.String(), t.Null()]),
        pixKey: t.Union([t.String(), t.Null()]),
      }),
    }
  )
  .patch(
    "/contracts/:id/installments/:installmentId",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      const { isOwner } = await getContractRole(user.id, params.id);
      if (!isOwner) {
        throw new ForbiddenError("Apenas o dono edita parcelas");
      }

      const [updated] = await db
        .update(installment)
        .set({
          ...(body.amountCents === undefined
            ? {}
            : { amountCents: body.amountCents }),
          ...(body.dueDate === undefined ? {} : { dueDate: body.dueDate }),
        })
        .where(
          and(
            eq(installment.id, params.installmentId),
            eq(installment.contractId, params.id)
          )
        )
        .returning({ id: installment.id });

      if (!updated) {
        throw new ForbiddenError("Parcela não pertence ao contrato");
      }
      return { id: updated.id };
    },
    {
      params: t.Object({ id: idParam, installmentId: idParam }),
      body: t.Object({
        amountCents: t.Optional(t.Integer({ minimum: 1 })),
        dueDate: t.Optional(t.String({ format: "date" })),
      }),
      response: t.Object({ id: t.String() }),
    }
  )
  .delete(
    "/contracts/:id",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const { isOwner } = await getContractRole(user.id, params.id); // 404 se sem acesso
      if (!isOwner) {
        throw new ForbiddenError("Apenas o dono exclui o contrato");
      }

      const keys = await db
        .select({ objectKey: proof.objectKey })
        .from(proof)
        .innerJoin(installment, eq(proof.installmentId, installment.id))
        .where(eq(installment.contractId, params.id));

      await db.delete(contract).where(eq(contract.id, params.id)); // cascata cuida do resto

      try {
        await deleteObjects(keys.map((k) => k.objectKey));
      } catch (err) {
        console.error("[delete-contract] falha ao purgar R2", err);
      }

      return { ok: true as const };
    },
    {
      params: t.Object({ id: idParam }),
      response: t.Object({ ok: t.Literal(true) }),
    }
  )
  .delete(
    "/contracts/:id/me",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const { isOwner } = await getContractRole(user.id, params.id); // 404 se sem acesso
      if (isOwner) {
        throw new ForbiddenError("O dono não pode sair; exclua o contrato");
      }

      await db.transaction(async (tx) => {
        const [slot] = await tx
          .select({ displayName: participant.displayName })
          .from(participant)
          .where(
            and(
              eq(participant.contractId, params.id),
              eq(participant.linkedUserId, user.id)
            )
          )
          .limit(1);
        const [c] = await tx
          .select({ ownerId: contract.ownerId })
          .from(contract)
          .where(eq(contract.id, params.id))
          .limit(1);

        await tx
          .delete(participant)
          .where(
            and(
              eq(participant.contractId, params.id),
              eq(participant.linkedUserId, user.id)
            )
          );

        await recordEvent(tx, {
          contractId: params.id,
          actorUserId: user.id,
          type: AUDIT_TYPE.participantLeft,
          metadata: slot ? { participantName: slot.displayName } : undefined,
        });

        if (c) {
          await createNotifications(tx, [
            {
              userId: c.ownerId,
              type: NOTIFICATION_TYPE.participantLeft,
              contractId: params.id,
              metadata: slot ? { participantName: slot.displayName } : null,
            },
          ]);
        }
      });

      return { ok: true as const };
    },
    {
      params: t.Object({ id: idParam }),
      response: t.Object({ ok: t.Literal(true) }),
    }
  );
