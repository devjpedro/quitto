import { describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { notification, participant } from "../src/db/schema";

// ── helpers copied from tests/payments.test.ts ──

async function signUpCookie(tag: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "T",
        email: `${tag}-${Date.now()}@e.com`,
        password: "password123",
      }),
    })
  );
  return (res.headers.get("set-cookie") as string).split(";")[0] as string;
}

async function createContract(cookie: string, requiresConfirmation: boolean) {
  const res = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "C",
        ownerRole: "buyer",
        requiresConfirmation,
        schedule: {
          mode: "auto",
          totalAmountCents: 3000,
          installmentsCount: 3,
          firstDueDate: "2026-07-10",
        },
      }),
    })
  );
  return (await res.json()).id as string;
}

async function firstInstallmentId(
  cookie: string,
  contractId: string
): Promise<string> {
  const res = await app.handle(
    new Request(`http://localhost/api/contracts/${contractId}`, {
      headers: { cookie },
    })
  );
  return (await res.json()).installments[0].id as string;
}

async function uploadProof(cookie: string, installmentId: string) {
  const presign = await (
    await app.handle(
      new Request(
        `http://localhost/api/installments/${installmentId}/proofs/presign`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({
            fileName: "c.pdf",
            mimeType: "application/pdf",
          }),
        }
      )
    )
  ).json();
  await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "application/pdf" },
    body: "%PDF-1.4 fake",
  });
  return app.handle(
    new Request(`http://localhost/api/installments/${installmentId}/proofs`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        objectKey: presign.objectKey,
        fileName: "c.pdf",
        mimeType: "application/pdf",
      }),
    })
  );
}

// ── end helpers ──

const hasStorage = Boolean(process.env.S3_ENDPOINT);

/** Reads the session userId from the cookie (via GET /api/me). */
async function meId(cookie: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/me", { headers: { cookie } })
  );
  return (await res.json()).id as string;
}

function notifsFor(userId: string, contractId: string) {
  return db
    .select()
    .from(notification)
    .where(
      and(
        eq(notification.userId, userId),
        eq(notification.contractId, contractId)
      )
    );
}

describe("gatilhos de notificação", () => {
  it.skipIf(!hasStorage)(
    "comprovante enviado (com confirmação) notifica o aprovador, não o ator",
    async () => {
      const ownerCookie = await signUpCookie("payn-own");
      const contractId = await createContract(ownerCookie, true); // requiresConfirmation
      const ownerId = await meId(ownerCookie);

      const sellerCookie = await signUpCookie("payn-sell");
      const sellerId = await meId(sellerCookie);
      await db.insert(participant).values({
        contractId,
        displayName: "Vendedor",
        role: "seller",
        linkedUserId: sellerId,
      });

      const instId = await firstInstallmentId(ownerCookie, contractId);
      await uploadProof(ownerCookie, instId); // owner = comprador = payer = ator

      const toSeller = await notifsFor(sellerId, contractId);
      const toOwner = await notifsFor(ownerId, contractId);
      expect(toSeller.map((n) => n.type)).toContain("proof_submitted");
      expect(toOwner).toHaveLength(0); // ator não se notifica
    }
  );

  it.skipIf(!hasStorage)(
    "sem confirmação: comprovante vira paga e notifica a contraparte",
    async () => {
      const ownerCookie = await signUpCookie("payn-np-own");
      const contractId = await createContract(ownerCookie, false);
      const sellerCookie = await signUpCookie("payn-np-sell");
      const sellerId = await meId(sellerCookie);
      await db.insert(participant).values({
        contractId,
        displayName: "Vendedor",
        role: "seller",
        linkedUserId: sellerId,
      });
      const instId = await firstInstallmentId(ownerCookie, contractId);
      await uploadProof(ownerCookie, instId);

      const toSeller = await notifsFor(sellerId, contractId);
      expect(toSeller.map((n) => n.type)).toContain("installment_paid");
    }
  );

  it.skipIf(!hasStorage)("confirmar notifica o pagador", async () => {
    const ownerCookie = await signUpCookie("payn-cf-own");
    const contractId = await createContract(ownerCookie, true);
    const ownerId = await meId(ownerCookie);
    const sellerCookie = await signUpCookie("payn-cf-sell");
    const sellerId = await meId(sellerCookie);
    await db.insert(participant).values({
      contractId,
      displayName: "Vendedor",
      role: "seller",
      linkedUserId: sellerId,
    });
    const instId = await firstInstallmentId(ownerCookie, contractId);
    await uploadProof(ownerCookie, instId); // payer envia
    await app.handle(
      new Request(`http://localhost/api/installments/${instId}/confirm`, {
        method: "POST",
        headers: { cookie: sellerCookie },
      })
    ); // aprovador confirma

    const toOwner = await notifsFor(ownerId, contractId);
    expect(toOwner.map((n) => n.type)).toContain("payment_confirmed");
  });

  it.skipIf(!hasStorage)(
    "contestar notifica o pagador com o motivo no metadata",
    async () => {
      const ownerCookie = await signUpCookie("payn-dp-own");
      const contractId = await createContract(ownerCookie, true); // requiresConfirmation
      const ownerId = await meId(ownerCookie);

      const sellerCookie = await signUpCookie("payn-dp-sell");
      const sellerId = await meId(sellerCookie);
      await db.insert(participant).values({
        contractId,
        displayName: "Vendedor",
        role: "seller",
        linkedUserId: sellerId,
      });

      const instId = await firstInstallmentId(ownerCookie, contractId);
      await uploadProof(ownerCookie, instId); // payer (owner=buyer) envia comprovante

      const disputeReason = "Comprovante ilegível, não é possível confirmar";
      const disputeRes = await app.handle(
        new Request(`http://localhost/api/installments/${instId}/dispute`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: sellerCookie,
          },
          body: JSON.stringify({ reason: disputeReason }),
        })
      ); // aprovador (seller) contesta
      expect(disputeRes.status).toBe(200);

      const toOwner = await notifsFor(ownerId, contractId);
      const disputed = toOwner.find((n) => n.type === "payment_disputed");
      expect(disputed).toBeDefined();
      expect((disputed?.metadata as Record<string, unknown>)?.reason).toBe(
        disputeReason
      );
    }
  );
});

describe("endpoints de notificação", () => {
  async function seed(userId: string, contractId: string, readAt: Date | null) {
    await db.insert(notification).values({
      userId,
      type: "payment_confirmed",
      contractId,
      readAt,
    });
  }

  it("lista só as do próprio usuário e conta as não-lidas", async () => {
    const aCookie = await signUpCookie("notif-a");
    const aId = await meId(aCookie);
    const bCookie = await signUpCookie("notif-b");
    const bId = await meId(bCookie);
    const contractId = await createContract(aCookie, false);

    await seed(aId, contractId, null);
    await seed(aId, contractId, null);
    await seed(bId, contractId, null); // do outro usuário

    const list = await (
      await app.handle(
        new Request("http://localhost/api/notifications", {
          headers: { cookie: aCookie },
        })
      )
    ).json();
    expect(list.length).toBe(2);

    const count = await (
      await app.handle(
        new Request("http://localhost/api/notifications/unread-count", {
          headers: { cookie: aCookie },
        })
      )
    ).json();
    expect(count.count).toBe(2);
  });

  it("marcar uma como lida zera só ela; cross-user dá 404", async () => {
    const aCookie = await signUpCookie("notif-mr-a");
    const aId = await meId(aCookie);
    const bCookie = await signUpCookie("notif-mr-b");
    const contractId = await createContract(aCookie, false);
    await seed(aId, contractId, null);

    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.userId, aId));
    const row = rows[0];
    if (!row) {
      throw new Error("notification not seeded");
    }

    const forbidden = await app.handle(
      new Request(`http://localhost/api/notifications/${row.id}/read`, {
        method: "POST",
        headers: { cookie: bCookie },
      })
    );
    expect(forbidden.status).toBe(404);

    const ok = await app.handle(
      new Request(`http://localhost/api/notifications/${row.id}/read`, {
        method: "POST",
        headers: { cookie: aCookie },
      })
    );
    expect(ok.status).toBe(200);

    const count = await (
      await app.handle(
        new Request("http://localhost/api/notifications/unread-count", {
          headers: { cookie: aCookie },
        })
      )
    ).json();
    expect(count.count).toBe(0);
  });

  it("read-all zera o contador", async () => {
    const cookie = await signUpCookie("notif-ra");
    const id = await meId(cookie);
    const contractId = await createContract(cookie, false);
    await seed(id, contractId, null);
    await seed(id, contractId, null);

    await app.handle(
      new Request("http://localhost/api/notifications/read-all", {
        method: "POST",
        headers: { cookie },
      })
    );
    const count = await (
      await app.handle(
        new Request("http://localhost/api/notifications/unread-count", {
          headers: { cookie },
        })
      )
    ).json();
    expect(count.count).toBe(0);
  });
});
