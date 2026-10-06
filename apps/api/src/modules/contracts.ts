import {
  AUDIT_TYPE,
  generateMonthlySchedule,
  generateSchedule,
  NOTIFICATION_TYPE,
  parsePixKey,
  type ScheduleRow,
  todayISO,
} from "@quitto/shared";
import { and, eq, inArray } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, installment, participant, proof } from "../db/schema";
import { recordEvent } from "../lib/audit";
import { getContractRole } from "../lib/contract-access";
import { computeNextDueDate, computeProgress } from "../lib/contract-progress";
import { visibleContractsWhere } from "../lib/contract-visibility";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";
import { createNotifications } from "../lib/notifications";
import { idParam } from "../lib/route-params";
import { requireAuth } from "../lib/session";
import { deleteObjects } from "../lib/storage";

const ScheduleAuto = t.Object({
  mode: t.Literal("auto"),
  totalAmountCents: t.Integer({ minimum: 1 }),
  installmentsCount: t.Integer({ minimum: 1, maximum: 600 }),
  firstDueDate: t.String({ format: "date" }),
});

const ScheduleCustom = t.Object({
  mode: t.Literal("custom"),
  installments: t.Array(
    t.Object({
      amountCents: t.Integer({ minimum: 1 }),
      dueDate: t.String({ format: "date" }),
    }),
    { minItems: 1, maxItems: 600 }
  ),
});

const ScheduleMonthly = t.Object({
  mode: t.Literal("monthly"),
  monthlyAmountCents: t.Integer({ minimum: 1 }),
  months: t.Integer({ minimum: 1, maximum: 600 }),
  firstDueDate: t.String({ format: "date" }),
});

const CreateContractBody = t.Object({
  title: t.String({ minLength: 1, maxLength: 200 }),
  description: t.Optional(t.String({ maxLength: 2000 })),
  ownerRole: t.Union([t.Literal("buyer"), t.Literal("seller")]),
  requiresConfirmation: t.Boolean(),
  schedule: t.Union([ScheduleAuto, ScheduleCustom, ScheduleMonthly]),
});

export const contractsModule = new Elysia({ prefix: "/api" })
  .post(
    "/contracts",
    async ({ request, body }) => {
      const { user } = await requireAuth(request.headers);

      let rows: ScheduleRow[];
      if (body.schedule.mode === "auto") {
        rows = generateSchedule({
          totalAmountCents: body.schedule.totalAmountCents,
          installmentsCount: body.schedule.installmentsCount,
          firstDueDate: body.schedule.firstDueDate,
        });
      } else if (body.schedule.mode === "monthly") {
        rows = generateMonthlySchedule({
          monthlyAmountCents: body.schedule.monthlyAmountCents,
          months: body.schedule.months,
          firstDueDate: body.schedule.firstDueDate,
        });
      } else {
        rows = body.schedule.installments.map((it, i) => ({
          sequence: i + 1,
          amountCents: it.amountCents,
          dueDate: it.dueDate,
        }));
      }

      const totalAmountCents = rows.reduce((acc, r) => acc + r.amountCents, 0);

      const id = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(contract)
          .values({
            ownerId: user.id,
            title: body.title,
            description: body.description ?? null,
            ownerRole: body.ownerRole,
            totalAmountCents,
            installmentsCount: rows.length,
            requiresConfirmation: body.requiresConfirmation,
            monthlyAmountCents:
              body.schedule.mode === "monthly"
                ? body.schedule.monthlyAmountCents
                : null,
          })
          .returning({ id: contract.id });

        if (!created) {
          throw new Error("contract insert returned no row");
        }
        const contractId = created.id;

        await tx.insert(installment).values(
          rows.map((r) => ({
            contractId,
            sequence: r.sequence,
            amountCents: r.amountCents,
            dueDate: r.dueDate,
          }))
        );

        await tx.insert(participant).values({
          contractId,
          displayName: user.name,
          role: body.ownerRole, // dono ocupa o slot comprador/vendedor
          linkedUserId: user.id,
        });

        return contractId;
      });

      return { id };
    },
    {
      body: CreateContractBody,
      response: t.Object({ id: t.String() }),
    }
  )
  .get(
    "/contracts",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);

      const rows = await db
        .select()
        .from(contract)
        .where(visibleContractsWhere(user.id));

      if (rows.length === 0) {
        return [];
      }

      const ids = rows.map((r) => r.id);
      const items = await db
        .select()
        .from(installment)
        .where(inArray(installment.contractId, ids));

      const people = await db
        .select({
          contractId: participant.contractId,
          displayName: participant.displayName,
        })
        .from(participant)
        .where(inArray(participant.contractId, ids));

      const namesByContract = new Map<string, string[]>();
      for (const person of people) {
        const current = namesByContract.get(person.contractId);
        if (current) {
          current.push(person.displayName);
        } else {
          namesByContract.set(person.contractId, [person.displayName]);
        }
      }

      const today = todayISO();

      return rows.map((c) => {
        const contractInstallments = items.filter(
          (it) => it.contractId === c.id
        );
        const progress = computeProgress(contractInstallments, today);
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          participantNames: namesByContract.get(c.id) ?? [],
          ownerRole: c.ownerRole,
          status: c.status,
          totalCents: progress.totalCents,
          paidCents: progress.paidCents,
          percent: progress.percent,
          overdueCount: progress.overdueCount,
          installmentsCount: c.installmentsCount,
          nextDueDate: computeNextDueDate(contractInstallments),
        };
      });
    },
    {
      response: t.Array(
        t.Object({
          id: t.String(),
          title: t.String(),
          description: t.Union([t.String(), t.Null()]),
          participantNames: t.Array(t.String()),
          ownerRole: t.String(),
          status: t.String(),
          totalCents: t.Integer(),
          paidCents: t.Integer(),
          percent: t.Integer(),
          overdueCount: t.Integer(),
          installmentsCount: t.Integer(),
          nextDueDate: t.Union([t.String(), t.Null()]),
        })
      ),
    }
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
