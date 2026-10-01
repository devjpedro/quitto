import { CONTRACT_STATUS, INSTALLMENT_STATUS, todayISO } from "@quitto/shared";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db/client";
import { contract, installment, participant } from "../db/schema";
import { env } from "../env";
import { type SendEmailInput, sendEmail } from "../lib/mailer";
import {
  insertNotificationsReturning,
  resolvePayerUserIds,
} from "../lib/notifications";
import { sendReminderEmails } from "../lib/reminder-emails";
import { computeReminders, type ReminderInput } from "../lib/reminders";

export interface SweepDeps {
  emailEnabled?: boolean;
  send?: (i: SendEmailInput) => Promise<void>;
  webOrigin?: string;
}

export interface SweepResult {
  emailsSent: number;
  reminders: number;
}

/**
 * Loads open installments of active contracts, resolves payer, persists reminders. Idempotent via dedupeKey.
 *
 * @returns `reminders`: number COMPUTED for today (requested; idempotent inserts via dedupeKey may persist fewer on repeat runs); `emailsSent`: digest e-mails delivered (only for newly inserted reminders, opt-in users, when enabled).
 */
export async function runReminderSweep(
  deps: SweepDeps = {}
): Promise<SweepResult> {
  const emailEnabled =
    deps.emailEnabled ?? env.EMAIL_REMINDERS_ENABLED === "true";
  const today = todayISO();

  const activeContracts = await db
    .select({
      id: contract.id,
      ownerId: contract.ownerId,
      ownerRole: contract.ownerRole,
    })
    .from(contract)
    .where(eq(contract.status, CONTRACT_STATUS.active));
  if (activeContracts.length === 0) {
    return { reminders: 0, emailsSent: 0 };
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

  const receiverByContract = new Map(
    activeContracts.map((c) => [
      c.id,
      c.ownerRole === "seller" ? c.ownerId : null,
    ])
  );

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
    receiverUserId: receiverByContract.get(i.contractId) ?? null,
  }));

  const reminders = computeReminders(inputs, today);
  const inserted = await insertNotificationsReturning(db, reminders);
  const emailsSent = emailEnabled
    ? await sendReminderEmails(inserted, {
        send: deps.send ?? sendEmail,
        webOrigin: deps.webOrigin ?? env.WEB_ORIGIN,
      })
    : 0;
  return { reminders: reminders.length, emailsSent };
}

// Executado diretamente (Fly scheduled Machine / `bun run cron:reminders`).
if (import.meta.main) {
  const { reminders, emailsSent } = await runReminderSweep();
  console.log(`[cron:reminders] ${reminders} lembretes, ${emailsSent} e-mails`);
  process.exit(0);
}
