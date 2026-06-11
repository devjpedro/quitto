import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, installment, participant } from "../db/schema";
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
  ownerRole: t.Union([
    t.Literal("buyer"),
    t.Literal("seller"),
    t.Literal("neutral"),
  ]),
  requiresConfirmation: t.Boolean(),
  schedule: t.Union([ScheduleAuto, ScheduleCustom]),
});

export const contractsModule = new Elysia({ prefix: "/api" }).post(
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
);
