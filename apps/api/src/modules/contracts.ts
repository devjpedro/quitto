import { and, eq, inArray, or } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, installment, participant } from "../db/schema";
import { getContractRole } from "../lib/contract-access";
import { computeProgress } from "../lib/contract-progress";
import { ForbiddenError, NotFoundError } from "../lib/errors";
import { generateSchedule } from "../lib/schedule";
import { requireAuth } from "../lib/session";

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

const CreateContractBody = t.Object({
  title: t.String({ minLength: 1, maxLength: 200 }),
  description: t.Optional(t.String({ maxLength: 2000 })),
  ownerRole: t.Union([t.Literal("buyer"), t.Literal("seller")]),
  requiresConfirmation: t.Boolean(),
  schedule: t.Union([ScheduleAuto, ScheduleCustom]),
});

export const contractsModule = new Elysia({ prefix: "/api" })
  .post(
    "/contracts",
    async ({ request, body }) => {
      const { user } = await requireAuth(request.headers);

      const rows =
        body.schedule.mode === "auto"
          ? generateSchedule({
              totalAmountCents: body.schedule.totalAmountCents,
              installmentsCount: body.schedule.installmentsCount,
              firstDueDate: body.schedule.firstDueDate,
            })
          : body.schedule.installments.map((it, i) => ({
              sequence: i + 1,
              amountCents: it.amountCents,
              dueDate: it.dueDate,
            }));

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
          role: "owner",
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

      const linked = await db
        .select({ contractId: participant.contractId })
        .from(participant)
        .where(eq(participant.linkedUserId, user.id));
      const linkedIds = linked.map((l) => l.contractId);

      const rows = await db
        .select()
        .from(contract)
        .where(
          linkedIds.length > 0
            ? or(eq(contract.ownerId, user.id), inArray(contract.id, linkedIds))
            : eq(contract.ownerId, user.id)
        );

      if (rows.length === 0) {
        return [];
      }

      const ids = rows.map((r) => r.id);
      const items = await db
        .select()
        .from(installment)
        .where(inArray(installment.contractId, ids));
      const today = new Date().toISOString().slice(0, 10);

      return rows.map((c) => {
        const contractInstallments = items.filter(
          (it) => it.contractId === c.id
        );
        const progress = computeProgress(contractInstallments, today);
        return {
          id: c.id,
          title: c.title,
          ownerRole: c.ownerRole,
          status: c.status,
          totalCents: progress.totalCents,
          paidCents: progress.paidCents,
          percent: progress.percent,
          overdueCount: progress.overdueCount,
          installmentsCount: c.installmentsCount,
        };
      });
    },
    {
      response: t.Array(
        t.Object({
          id: t.String(),
          title: t.String(),
          ownerRole: t.String(),
          status: t.String(),
          totalCents: t.Integer(),
          paidCents: t.Integer(),
          percent: t.Integer(),
          overdueCount: t.Integer(),
          installmentsCount: t.Integer(),
        })
      ),
    }
  )
  .get(
    "/contracts/:id",
    async ({ request, params }) => {
      const { user } = await requireAuth(request.headers);
      const role = await getContractRole(user.id, params.id); // lança 404 se sem acesso

      const [c] = await db
        .select()
        .from(contract)
        .where(eq(contract.id, params.id))
        .limit(1);
      if (!c) {
        throw new NotFoundError("Contrato não encontrado");
      }
      const items = await db
        .select()
        .from(installment)
        .where(eq(installment.contractId, params.id));
      const people = await db
        .select()
        .from(participant)
        .where(eq(participant.contractId, params.id));
      const today = new Date().toISOString().slice(0, 10);
      const progress = computeProgress(items, today);

      return {
        role,
        contract: {
          id: c.id,
          title: c.title,
          description: c.description,
          ownerRole: c.ownerRole,
          requiresConfirmation: c.requiresConfirmation,
          status: c.status,
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
          })),
        participants: people.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          role: p.role,
          linked: p.linkedUserId !== null,
        })),
      };
    },
    {
      params: t.Object({ id: t.String() }),
      response: t.Object({
        role: t.String(),
        contract: t.Object({
          id: t.String(),
          title: t.String(),
          description: t.Union([t.String(), t.Null()]),
          ownerRole: t.String(),
          requiresConfirmation: t.Boolean(),
          status: t.String(),
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
          })
        ),
        participants: t.Array(
          t.Object({
            id: t.String(),
            displayName: t.String(),
            role: t.String(),
            linked: t.Boolean(),
          })
        ),
      }),
    }
  )
  .patch(
    "/contracts/:id/installments/:installmentId",
    async ({ request, params, body }) => {
      const { user } = await requireAuth(request.headers);
      const role = await getContractRole(user.id, params.id);
      if (role !== "owner") {
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
      params: t.Object({ id: t.String(), installmentId: t.String() }),
      body: t.Object({
        amountCents: t.Optional(t.Integer({ minimum: 1 })),
        dueDate: t.Optional(t.String({ format: "date" })),
      }),
      response: t.Object({ id: t.String() }),
    }
  );
