import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db/client";
import { contract, installment, participant } from "../db/schema";
import { createNotifications, resolvePayerUserIds } from "../lib/notifications";
import { computeReminders, type ReminderInput } from "../lib/reminders";

/** YYYY-MM-DD de hoje (UTC). */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Loads open installments of active contracts, resolves payer, persists reminders. Idempotent via dedupeKey. */
export async function runReminderSweep(): Promise<number> {
  const today = todayISO();

  const activeContracts = await db
    .select({ id: contract.id, ownerId: contract.ownerId })
    .from(contract)
    .where(eq(contract.status, "active"));
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
    payerByContract.set(c.id, set.values().next().value ?? null);
  }

  const openInstallments = await db
    .select({
      id: installment.id,
      contractId: installment.contractId,
      dueDate: installment.dueDate,
    })
    .from(installment)
    .where(
      and(
        inArray(installment.contractId, contractIds),
        ne(installment.status, "paid")
      )
    );

  const inputs: ReminderInput[] = openInstallments.map((i) => ({
    installmentId: i.id,
    contractId: i.contractId,
    dueDate: i.dueDate,
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
