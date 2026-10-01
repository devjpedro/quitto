import { describe, expect, it } from "bun:test";
import { todayISO } from "@quitto/shared";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { runReminderSweep } from "../src/cron/reminders";
import { db } from "../src/db/client";
import { notification, user } from "../src/db/schema";
import { addDays } from "../src/lib/dates";
import type { SendEmailInput } from "../src/lib/mailer";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

async function userWithOverdueContract(tag: string, optIn: boolean) {
  const email = uniqueEmail(tag);
  const cookie = await signUpCookie(email);
  await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: `Contrato ${tag}`,
        ownerRole: "buyer",
        requiresConfirmation: false,
        schedule: {
          mode: "auto",
          totalAmountCents: 3000,
          installmentsCount: 2,
          firstDueDate: addDays(todayISO(), -2),
        },
      }),
    })
  );
  await db
    .update(user)
    .set({ emailRemindersOptIn: optIn })
    .where(eq(user.email, email));
  return email;
}

function recorder() {
  const sent: SendEmailInput[] = [];
  return {
    sent,
    send: (i: SendEmailInput) => {
      sent.push(i);
      return Promise.resolve();
    },
  };
}
const webOrigin = "https://app.test";

describe("e-mail de lembrete na varredura", () => {
  it("chave global desligada → nenhum envio", async () => {
    const email = await userWithOverdueContract("rem-off", true);
    const r = recorder();
    await runReminderSweep({ emailEnabled: false, send: r.send, webOrigin });
    expect(r.sent.filter((s) => s.to === email)).toHaveLength(0);
  });

  it("ligada + opt-in → 1 e-mail com os itens; 2ª varredura → nada", async () => {
    const email = await userWithOverdueContract("rem-on", true);
    const r1 = recorder();
    await runReminderSweep({ emailEnabled: true, send: r1.send, webOrigin });
    const mine = r1.sent.filter((s) => s.to === email);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.html).toContain("Contrato rem-on");
    expect(mine[0]?.html).toContain("https://app.test/settings");

    const r2 = recorder();
    await runReminderSweep({ emailEnabled: true, send: r2.send, webOrigin });
    expect(r2.sent.filter((s) => s.to === email)).toHaveLength(0);
  });

  it("ligada + opt-out → nenhum envio", async () => {
    const email = await userWithOverdueContract("rem-out", false);
    const r = recorder();
    await runReminderSweep({ emailEnabled: true, send: r.send, webOrigin });
    expect(r.sent.filter((s) => s.to === email)).toHaveLength(0);
  });

  it("falha de envio pra um usuário não impede o outro nem as notificações in-app", async () => {
    const a = await userWithOverdueContract("rem-fail-a", true);
    const b = await userWithOverdueContract("rem-fail-b", true);
    const delivered: string[] = [];
    const result = await runReminderSweep({
      emailEnabled: true,
      webOrigin,
      send: (i) => {
        if (i.to === a) {
          return Promise.reject(new Error("boom"));
        }
        delivered.push(i.to);
        return Promise.resolve();
      },
    });
    expect(result.emailsSent).toBeGreaterThanOrEqual(1);
    expect(delivered).toContain(b);
    const [rowA] = await db.select().from(user).where(eq(user.email, a));
    const notifsA = await db
      .select()
      .from(notification)
      .where(eq(notification.userId, rowA?.id as string));
    expect(notifsA.length).toBeGreaterThan(0);
  });

  it("send lançando de forma síncrona pra todos → varredura resolve, notificações persistidas", async () => {
    const a = await userWithOverdueContract("rem-throw", true);
    const result = await runReminderSweep({
      emailEnabled: true,
      webOrigin,
      send: () => {
        throw new Error("sync boom");
      },
    });
    expect(result.emailsSent).toBe(0);
    const [rowA] = await db.select().from(user).where(eq(user.email, a));
    const notifsA = await db
      .select()
      .from(notification)
      .where(eq(notification.userId, rowA?.id as string));
    expect(notifsA.length).toBeGreaterThan(0);
  });
});
