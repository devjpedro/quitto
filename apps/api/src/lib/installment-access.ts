import { and, eq } from "drizzle-orm";
import { t } from "elysia";
import { db } from "../db/client";
import { contract, installment } from "../db/schema";
import { getCapabilities } from "./contract-access";
import { NotFoundError, ValidationError } from "./errors";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type InstallmentRow = typeof installment.$inferSelect;

/** Every installment mutation answers with the updated row, so the web can setQueryData. */
export const installmentEntitySchema = t.Object({
  id: t.String(),
  contractId: t.String(),
  sequence: t.Integer(),
  amountCents: t.Integer(),
  dueDate: t.String(),
  status: t.String(),
  paidAt: t.Union([t.String(), t.Null()]),
  confirmedAt: t.Union([t.String(), t.Null()]),
});

export function toInstallmentEntity(row: InstallmentRow) {
  return {
    id: row.id,
    contractId: row.contractId,
    sequence: row.sequence,
    amountCents: row.amountCents,
    dueDate: row.dueDate,
    status: row.status,
    paidAt: row.paidAt?.toISOString() ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  };
}

/**
 * Moves the installment out of the status it was read in. If someone else moved
 * it first (a double tap, the other party), no row matches: it throws 422 inside
 * the transaction, which rolls back before any event or notification is written.
 */
export async function transitionInstallment(
  tx: Tx,
  from: InstallmentRow,
  values: Partial<typeof installment.$inferInsert>
): Promise<InstallmentRow> {
  const [row] = await tx
    .update(installment)
    .set(values)
    .where(
      and(eq(installment.id, from.id), eq(installment.status, from.status))
    )
    .returning();
  if (!row) {
    throw new ValidationError(
      "A parcela mudou enquanto você agia; atualize e tente de novo"
    );
  }
  return row;
}

/** Loads installment + parent contract and the caller's capabilities. Throws 404 if no access. */
export async function loadInstallmentForUser(
  userId: string,
  installmentId: string
) {
  const [inst] = await db
    .select()
    .from(installment)
    .where(eq(installment.id, installmentId))
    .limit(1);
  if (!inst) {
    throw new NotFoundError("Parcela não encontrada");
  }
  const caps = await getCapabilities(userId, inst.contractId); // 404 se sem acesso
  const [c] = await db
    .select()
    .from(contract)
    .where(eq(contract.id, inst.contractId))
    .limit(1);
  if (!c) {
    throw new NotFoundError("Contrato não encontrado");
  }
  return { inst, contract: c, caps };
}
