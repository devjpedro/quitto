import { CONTRACT_STATUS, INSTALLMENT_STATUS } from "@quitto/shared";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db/client";
import { contract, installment, participant } from "../db/schema";
import { createNotifications, resolvePayerUserIds } from "../lib/notifications";
import { computeReminders, type ReminderInput } from "../lib/reminders";

/** Today's date as YYYY-MM-DD (UTC). Note: near local midnight this can drift one day from the user's wall-clock date; acceptable for a daily sweep since dedupeKey prevents duplicates and the next run self-corrects. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Loads open installments of active contracts, resolves payer, persists reminders. Idempotent via dedupeKey.
 *
 * @returns the number of reminders COMPUTED for today (requested). Idempotent inserts via dedupeKey may persist fewer rows on repeat runs.
 */
export async function runReminderSweep(): Promise<number> {
  const today = todayISO();

  const activeContracts = await db
    .select({ id: contract.id, ownerId: contract.ownerId })
    .from(contract)
    .where(eq(contract.status, CONTRACT_STATUS.active));
  if (activeContracts.length === 0) {
    return 0;
  }
  const contractIds = activeContracts.map((c) => c.id);

  const people = await db
    .select({
      contractId: participant.contractId,
      role: participant.role,
      linkedUserId: participant.linkedUserId,
    })
    .from(participant)
    .where(inArray(participant.contractId, contractIds));

  // payer (1º vinculado) por contrato
  const payerByContract = new Map<string, string | null>();
  for (const c of activeContracts) {
    const set = resolvePayerUserIds(
      people.filter((p) => p.contractId === c.id),
      c.ownerId
    );
    // A contract has at most one payer (buyer slot is unique per contract; the owner only inherits payer when no buyer is linked), so taking the first element is deterministic.
    payerByContract.set(c.id, set.values().next().value ?? null);
  }

  const openInstallments = await db
    .select({
      id: installment.id,
      contractId: installment.contractId,
      dueDate: installment.dueDate,
      status: installment.status,
    })
    .from(installment)
    .where(
      and(
        inArray(installment.contractId, contractIds),
        ne(installment.status, INSTALLMENT_STATUS.paid)
      )
    );

  const inputs: ReminderInput[] = openInstallments.map((i) => ({
    installmentId: i.id,
    contractId: i.contractId,
    dueDate: i.dueDate,
    status: i.status,
    payerUserId: payerByContract.get(i.contractId) ?? null,
  }));

  const reminders = computeReminders(inputs, today);
  await createNotifications(db, reminders);
  return reminders.length;
}

// Executado diretamente (Fly scheduled Machine / `bun run cron:reminders`).
if (import.meta.main) {
  const created = await runReminderSweep();
  console.log(`[cron:reminders] criados/garantidos ${created} lembretes`);
  process.exit(0);
}
