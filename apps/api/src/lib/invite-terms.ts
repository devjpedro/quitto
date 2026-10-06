import { count, inArray, max, min, sql, sum } from "drizzle-orm";
import { db } from "../db/client";
import { installment } from "../db/schema";

/**
 * An invited contract's conditions, from its installments (never
 * contract.totalAmountCents: editing one installment does not update it).
 * The home's invite card and the invite page read the same thing.
 */
export interface InviteTerms {
  /** One amount per installment, or null when they differ (the phrase shows the total). */
  amountCents: number | null;
  /** The day every installment falls on, or null when they differ (a 31st clamped to a 30th). */
  dayOfMonth: number | null;
  firstDueDate: string | null;
  installmentsCount: number;
  lastDueDate: string | null;
  maxCents: number | null;
  minCents: number | null;
  totalCents: number;
}

export interface InviteTermsRow {
  firstDueDate: string | null;
  installmentsCount: number;
  lastDueDate: string | null;
  maxCents: number | null;
  maxDay: number | null;
  minCents: number | null;
  minDay: number | null;
  totalCents: number | null;
}

export function toInviteTerms(row: InviteTermsRow): InviteTerms {
  return {
    amountCents:
      row.minCents !== null && row.minCents === row.maxCents
        ? row.minCents
        : null,
    dayOfMonth:
      row.minDay !== null && row.minDay === row.maxDay ? row.minDay : null,
    firstDueDate: row.firstDueDate,
    installmentsCount: row.installmentsCount,
    lastDueDate: row.lastDueDate,
    maxCents: row.maxCents,
    minCents: row.minCents,
    totalCents: row.totalCents ?? 0,
  };
}

/** The conditions of each contract, in one grouped read (moved from modules/home.ts). */
export async function loadInviteTerms(
  contractIds: string[]
): Promise<Map<string, InviteTerms>> {
  const terms = new Map<string, InviteTerms>();
  if (contractIds.length === 0) {
    return terms;
  }
  const rows = await db
    .select({
      contractId: installment.contractId,
      firstDueDate: min(installment.dueDate),
      lastDueDate: max(installment.dueDate),
      minCents: min(installment.amountCents),
      maxCents: max(installment.amountCents),
      totalCents: sum(installment.amountCents).mapWith(Number),
      installmentsCount: count(),
      minDay: sql<
        number | null
      >`min(extract(day from ${installment.dueDate}))::int`,
      maxDay: sql<
        number | null
      >`max(extract(day from ${installment.dueDate}))::int`,
    })
    .from(installment)
    .where(inArray(installment.contractId, contractIds))
    .groupBy(installment.contractId);
  for (const { contractId, ...row } of rows) {
    terms.set(contractId, toInviteTerms(row));
  }
  return terms;
}
