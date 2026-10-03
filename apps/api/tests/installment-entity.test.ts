import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { auditEvent, installment } from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

function post(cookie: string, path: string, body?: unknown) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

async function firstInstallment(cookie: string, requiresConfirmation: boolean) {
  const created = await post(cookie, "/api/contracts", {
    title: "Entidade",
    ownerRole: "buyer",
    requiresConfirmation,
    schedule: {
      mode: "auto",
      totalAmountCents: 3000,
      installmentsCount: 3,
      firstDueDate: "2026-07-10",
    },
  });
  const { id: contractId } = (await created.json()) as { id: string };
  const detail = await app.handle(
    new Request(`http://localhost/api/contracts/${contractId}`, {
      headers: { cookie },
    })
  );
  const body = (await detail.json()) as { installments: { id: string }[] };
  return { contractId, installmentId: body.installments[0]?.id as string };
}

describe("mutações de parcela devolvem a parcela atualizada", () => {
  it("mark-paid devolve status paid e paidAt", async () => {
    const cookie = await signUpCookie(uniqueEmail("entity-paid"));
    const { contractId, installmentId } = await firstInstallment(cookie, false);
    const res = await post(
      cookie,
      `/api/installments/${installmentId}/mark-paid`
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: installmentId,
      contractId,
      sequence: 1,
      amountCents: 1000,
      dueDate: "2026-07-10",
      status: "paid",
      confirmedAt: null,
    });
    expect(typeof body.paidAt).toBe("string");
  });

  it("confirm devolve status confirmed, confirmedAt e paidAt", async () => {
    const cookie = await signUpCookie(uniqueEmail("entity-confirm"));
    const { contractId, installmentId } = await firstInstallment(cookie, true);
    // The proof upload needs storage; the state it leaves behind is what matters here.
    await db
      .update(installment)
      .set({ status: "awaiting_confirmation" })
      .where(eq(installment.id, installmentId));
    const res = await post(
      cookie,
      `/api/installments/${installmentId}/confirm`
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: installmentId,
      contractId,
      sequence: 1,
      amountCents: 1000,
      dueDate: "2026-07-10",
      status: "confirmed",
    });
    expect(typeof body.confirmedAt).toBe("string");
    expect(typeof body.paidAt).toBe("string");
  });

  it("dispute devolve status disputed", async () => {
    const cookie = await signUpCookie(uniqueEmail("entity-dispute"));
    const { installmentId } = await firstInstallment(cookie, true);
    await db
      .update(installment)
      .set({ status: "awaiting_confirmation" })
      .where(eq(installment.id, installmentId));
    const res = await post(
      cookie,
      `/api/installments/${installmentId}/dispute`,
      {
        reason: "valor diferente",
      }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: installmentId,
      status: "disputed",
      paidAt: null,
      confirmedAt: null,
    });
  });

  it("dois mark-paid ao mesmo tempo: um passa, o outro dá 422 e só um evento fica", async () => {
    const cookie = await signUpCookie(uniqueEmail("entity-race"));
    const { installmentId } = await firstInstallment(cookie, false);
    const path = `/api/installments/${installmentId}/mark-paid`;

    const results = await Promise.all([post(cookie, path), post(cookie, path)]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
    const events = await db
      .select({ id: auditEvent.id })
      .from(auditEvent)
      .where(
        and(
          eq(auditEvent.installmentId, installmentId),
          eq(auditEvent.type, "installment_paid")
        )
      );
    expect(events).toHaveLength(1);
  });
});
