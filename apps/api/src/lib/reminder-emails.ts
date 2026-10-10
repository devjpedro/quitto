import { NOTIFICATION_TYPE } from "@quitto/shared";
import { captureException } from "@sentry/bun";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { contract, installment, user } from "../db/schema";
import { type ReminderEmailItem, reminderDigestEmail } from "./email-templates";
import { pickLocale } from "./locale";
import type { SendEmailInput } from "./mailer";
import type { InsertedNotification } from "./notifications";

const OVERDUE_TYPES = new Set<string>([
  NOTIFICATION_TYPE.installmentOverdue,
  NOTIFICATION_TYPE.installmentOverdueReceivable,
]);
const RECEIVE_TYPES = new Set<string>([
  NOTIFICATION_TYPE.installmentDueSoonReceivable,
  NOTIFICATION_TYPE.installmentOverdueReceivable,
]);

/** Um e-mail por usuário opt-in, só com as notificações recém-inseridas. Devolve quantos foram enviados. */
export async function sendReminderEmails(
  inserted: InsertedNotification[],
  deps: { send: (i: SendEmailInput) => Promise<void>; webOrigin: string }
): Promise<number> {
  const withInstallment = inserted.filter(
    (n): n is InsertedNotification & { installmentId: string } =>
      n.installmentId !== null
  );
  if (withInstallment.length === 0) {
    return 0;
  }
  const userIds = [...new Set(withInstallment.map((n) => n.userId))];
  const recipients = await db
    .select({
      id: user.id,
      email: user.email,
      locale: user.locale,
      name: user.name,
    })
    .from(user)
    .where(and(inArray(user.id, userIds), eq(user.emailRemindersOptIn, true)));
  if (recipients.length === 0) {
    return 0;
  }
  const optedIn = new Set(recipients.map((r) => r.id));
  const relevant = withInstallment.filter((n) => optedIn.has(n.userId));

  const insts = await db
    .select({
      id: installment.id,
      sequence: installment.sequence,
      amountCents: installment.amountCents,
      dueDate: installment.dueDate,
    })
    .from(installment)
    .where(
      inArray(installment.id, [
        ...new Set(relevant.map((n) => n.installmentId)),
      ])
    );
  const contracts = await db
    .select({ id: contract.id, title: contract.title })
    .from(contract)
    .where(
      inArray(contract.id, [...new Set(relevant.map((n) => n.contractId))])
    );
  const instById = new Map(insts.map((i) => [i.id, i]));
  const titleById = new Map(contracts.map((c) => [c.id, c.title]));

  let sent = 0;
  for (const r of recipients) {
    const items: ReminderEmailItem[] = [];
    for (const n of relevant) {
      const inst = instById.get(n.installmentId);
      if (n.userId !== r.id || !inst) {
        continue;
      }
      items.push({
        contractTitle: titleById.get(n.contractId) ?? "",
        contractUrl: `${deps.webOrigin}/contracts/${n.contractId}`,
        sequence: inst.sequence,
        amountCents: inst.amountCents,
        dueDate: inst.dueDate,
        overdue: OVERDUE_TYPES.has(n.type),
        direction: RECEIVE_TYPES.has(n.type) ? "receive" : "pay",
      });
    }
    if (items.length === 0) {
      continue;
    }
    items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const { subject, html } = reminderDigestEmail({
      name: r.name,
      locale: pickLocale(r.locale),
      items,
      homeUrl: `${deps.webOrigin}/`,
      settingsUrl: `${deps.webOrigin}/settings/reminders`,
    });
    try {
      await deps.send({ to: r.email, subject, html });
      sent += 1;
    } catch (error) {
      console.error(`[reminders] falha ao enviar e-mail para ${r.id}`, error);
      captureException(error);
    }
  }
  return sent;
}
