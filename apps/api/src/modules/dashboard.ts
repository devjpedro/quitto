import {
  type ContractStatus,
  DIRECTION,
  type InstallmentStatus,
} from "@quitto/shared";
import { eq, inArray, or } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { contract, installment, participant } from "../db/schema";
import {
  computeDashboard,
  type DashboardContractInput,
  type DashboardSlot,
} from "../lib/dashboard";
import { requireAuth } from "../lib/session";

function slotFor(
  role: string | undefined,
  isOwner: boolean,
  ownerRole: string
): DashboardSlot {
  if (role === "buyer" || role === "seller") {
    return role;
  }
  if (isOwner && (ownerRole === "buyer" || ownerRole === "seller")) {
    return ownerRole;
  }
  return "viewer";
}

export const dashboardModule = new Elysia({ prefix: "/api" }).get(
  "/dashboard",
  async ({ request }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { user } = await requireAuth(request.headers);

    const linked = await db
      .select({ contractId: participant.contractId, role: participant.role })
      .from(participant)
      .where(eq(participant.linkedUserId, user.id));
    const roleByContract = new Map(linked.map((l) => [l.contractId, l.role]));
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
      return computeDashboard([], today);
    }

    const ids = rows.map((r) => r.id);
    const items = await db
      .select()
      .from(installment)
      .where(inArray(installment.contractId, ids));

    const inputs: DashboardContractInput[] = rows.map((c) => ({
      contractId: c.id,
      title: c.title,
      userSlot: slotFor(
        roleByContract.get(c.id),
        c.ownerId === user.id,
        c.ownerRole
      ),
      status: c.status as ContractStatus,
      installments: items
        .filter((it) => it.contractId === c.id)
        .map((it) => ({
          id: it.id,
          sequence: it.sequence,
          amountCents: it.amountCents,
          dueDate: it.dueDate,
          status: it.status as InstallmentStatus,
        })),
    }));

    return computeDashboard(inputs, today);
  },
  {
    response: t.Object({
      toPayCents: t.Integer(),
      toReceiveCents: t.Integer(),
      overdueCount: t.Integer(),
      overdueCents: t.Integer(),
      activeContractsCount: t.Integer(),
      completedContractsCount: t.Integer(),
      upcoming: t.Array(
        t.Object({
          id: t.String(),
          contractId: t.String(),
          contractTitle: t.String(),
          sequence: t.Integer(),
          amountCents: t.Integer(),
          dueDate: t.String(),
          direction: t.Union([
            t.Literal(DIRECTION.pay),
            t.Literal(DIRECTION.receive),
          ]),
          isOverdue: t.Boolean(),
        })
      ),
    }),
  }
);
