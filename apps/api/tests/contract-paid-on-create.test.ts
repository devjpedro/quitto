import { describe, expect, it, spyOn } from "bun:test";
import { addMonths, todayISO } from "@quitto/shared";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { runReminderSweep } from "../src/cron/reminders";
import { db } from "../src/db/client";
import { auditEvent, installment, notification, proof } from "../src/db/schema";
// biome-ignore lint/performance/noNamespaceImport: spyOn needs a mutable module object to intercept the handler's named `headObject` import (ES named bindings are read-only)
import * as storage from "../src/lib/storage";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

const FIRST_DUE = addMonths(todayISO(), -3);

function body(extra: Record<string, unknown> = {}) {
  return {
    title: "Acordo em andamento",
    ownerRole: "buyer",
    requiresConfirmation: true,
    schedule: {
      mode: "split",
      totalAmountCents: 600_000,
      installmentsCount: 6,
      firstDueDate: FIRST_DUE,
    },
    ...extra,
  };
}

function post(cookie: string, payload: unknown) {
  return app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(payload),
    })
  );
}

async function rowsOf(contractId: string) {
  const rows = await db
    .select()
    .from(installment)
    .where(eq(installment.contractId, contractId));
  return rows.sort((a, b) => a.sequence - b.sequence);
}

describe("POST /api/contracts com parcelas já pagas", () => {
  it("grava as marcadas como pagas no vencimento e deixa o resto como está", async () => {
    const cookie = await signUpCookie(uniqueEmail("pagas"));
    const res = await post(cookie, body({ paidInstallments: [1, 2, 3] }));
    expect(res.status).toBe(200);
    const { id } = await res.json();
    const rows = await rowsOf(id);
    for (const row of rows.slice(0, 3)) {
      expect(row.status).toBe("paid");
      expect(row.registeredOnCreate).toBe(true);
      expect(row.paidAt?.toISOString().slice(0, 10)).toBe(row.dueDate);
    }
    for (const row of rows.slice(3)) {
      expect(row.status).toBe("pending");
      expect(row.registeredOnCreate).toBe(false);
      expect(row.paidAt).toBeNull();
    }
  });

  it("sem notificação nem lembrete, e um só evento no histórico", async () => {
    const cookie = await signUpCookie(uniqueEmail("pagas"));
    const { id } = await (
      await post(cookie, body({ paidInstallments: [1, 2, 3] }))
    ).json();
    await runReminderSweep({ emailEnabled: false });
    const notified = await db
      .select()
      .from(notification)
      .where(eq(notification.contractId, id));
    const paidIds = (await rowsOf(id)).slice(0, 3).map((r) => r.id);
    expect(
      notified.filter((n) => paidIds.includes(n.installmentId ?? ""))
    ).toEqual([]);
    const events = await db
      .select()
      .from(auditEvent)
      .where(eq(auditEvent.contractId, id));
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("installments_paid_on_create");
    expect(events[0]?.metadata).toEqual({ count: 3 });
  }, 30_000);

  it("sem paidInstallments nada muda: nenhum evento e tudo pendente", async () => {
    const cookie = await signUpCookie(uniqueEmail("pagas"));
    const { id } = await (await post(cookie, body())).json();
    expect((await rowsOf(id)).every((r) => r.status === "pending")).toBe(true);
    const events = await db
      .select()
      .from(auditEvent)
      .where(eq(auditEvent.contractId, id));
    expect(events).toEqual([]);
  });

  it("parcela futura: 422 com código e nada é criado", async () => {
    const cookie = await signUpCookie(uniqueEmail("pagas"));
    const res = await post(cookie, body({ paidInstallments: [6] }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(JSON.stringify(json)).toContain("installments.paid.future");
  });

  it("repetida e fora do intervalo: 422", async () => {
    const cookie = await signUpCookie(uniqueEmail("pagas"));
    const dup = await post(cookie, body({ paidInstallments: [1, 1] }));
    expect(JSON.stringify(await dup.json())).toContain(
      "installments.paid.duplicate"
    );
    const out = await post(cookie, body({ paidInstallments: [7] }));
    expect(JSON.stringify(await out.json())).toContain(
      "installments.paid.invalid"
    );
  });

  it("anexa comprovante depois: mantém o status e não notifica ninguém", async () => {
    const cookie = await signUpCookie(uniqueEmail("pagas"));
    const { id } = await (
      await post(cookie, body({ paidInstallments: [1] }))
    ).json();
    const [first] = await rowsOf(id);
    const head = spyOn(storage, "headObject").mockResolvedValue({
      ContentLength: 1234,
      ContentType: "application/pdf",
    } as Awaited<ReturnType<typeof storage.headObject>>);
    try {
      const res = await app.handle(
        new Request(`http://localhost/api/installments/${first?.id}/proofs`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({
            objectKey: `proofs/${id}/${first?.id}/x-recibo.pdf`,
            fileName: "recibo.pdf",
            mimeType: "application/pdf",
          }),
        })
      );
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe("paid");
    } finally {
      head.mockRestore();
    }
    const proofs = await db
      .select()
      .from(proof)
      .where(eq(proof.installmentId, first?.id ?? ""));
    expect(proofs).toHaveLength(1);
    const [after] = await rowsOf(id);
    expect(after?.status).toBe("paid");
    expect(after?.paidAt?.toISOString()).toBe(first?.paidAt?.toISOString());
    const notified = await db
      .select()
      .from(notification)
      .where(eq(notification.installmentId, first?.id ?? ""));
    expect(notified).toEqual([]);
  });
});
