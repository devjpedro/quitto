import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { auditEvent, notification, participant, user } from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

function call(cookie: string, path: string, method = "POST", body?: unknown) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

async function userId(email: string): Promise<string> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  return row?.id as string;
}

/** The owner receives (seller); a second account pays, linked as the buyer. */
async function sellerWithLinkedBuyer(requiresConfirmation: boolean) {
  const ownerEmail = uniqueEmail("recv-owner");
  const owner = await signUpCookie(ownerEmail);
  const payerEmail = uniqueEmail("recv-payer");
  const payer = await signUpCookie(payerEmail);
  const created = await call(owner, "/api/contracts", "POST", {
    title: "Moto do Rafa",
    ownerRole: "seller",
    requiresConfirmation,
    schedule: {
      mode: "auto",
      totalAmountCents: 96_000,
      installmentsCount: 2,
      firstDueDate: "2026-08-30",
    },
  });
  const { id: contractId } = (await created.json()) as { id: string };
  await db.insert(participant).values({
    contractId,
    displayName: "Rafael Prado",
    role: "buyer",
    linkedUserId: await userId(payerEmail),
  });
  const detail = await (
    await call(owner, `/api/contracts/${contractId}`, "GET")
  ).json();
  return {
    owner,
    payer,
    payerId: await userId(payerEmail),
    contractId,
    installmentId: detail.installments[0].id as string,
  };
}

describe("POST /installments/:id/mark-received", () => {
  it("com confirmação: o aprovador leva a parcela atrasada a confirmed, com evento e aviso a quem paga", async () => {
    const s = await sellerWithLinkedBuyer(true);
    const res = await call(
      s.owner,
      `/api/installments/${s.installmentId}/mark-received`
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: s.installmentId, status: "confirmed" });
    expect(typeof body.paidAt).toBe("string");
    expect(typeof body.confirmedAt).toBe("string");
    const events = await db
      .select({ type: auditEvent.type })
      .from(auditEvent)
      .where(eq(auditEvent.installmentId, s.installmentId));
    expect(events.map((e) => e.type)).toEqual(["installment_received"]);
    const notices = await db
      .select({ type: notification.type, metadata: notification.metadata })
      .from(notification)
      .where(
        and(
          eq(notification.installmentId, s.installmentId),
          eq(notification.userId, s.payerId)
        )
      );
    expect(notices).toEqual([
      { type: "payment_confirmed", metadata: { markedReceived: true } },
    ]);
  });

  it("sem confirmação: vai a paid, sem confirmedAt", async () => {
    const s = await sellerWithLinkedBuyer(false);
    const body = await (
      await call(s.owner, `/api/installments/${s.installmentId}/mark-received`)
    ).json();
    expect(body).toMatchObject({ status: "paid", confirmedAt: null });
  });

  it("quem paga não marca como recebida (403)", async () => {
    const s = await sellerWithLinkedBuyer(true);
    expect(
      (
        await call(
          s.payer,
          `/api/installments/${s.installmentId}/mark-received`
        )
      ).status
    ).toBe(403);
  });

  it("dois mark-received ao mesmo tempo: um passa, o outro dá 422 e só um evento fica", async () => {
    const s = await sellerWithLinkedBuyer(true);
    const path = `/api/installments/${s.installmentId}/mark-received`;
    const results = await Promise.all([
      call(s.owner, path),
      call(s.owner, path),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
    const events = await db
      .select({ id: auditEvent.id })
      .from(auditEvent)
      .where(
        and(
          eq(auditEvent.installmentId, s.installmentId),
          eq(auditEvent.type, "installment_received")
        )
      );
    expect(events).toHaveLength(1);
  });
});
