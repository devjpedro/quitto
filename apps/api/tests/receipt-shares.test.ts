import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import {
  auditEvent,
  contract,
  installment,
  receiptShare,
} from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

async function createPaidInstallment(cookie: string) {
  const created = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "Aluguel & cia",
        ownerRole: "buyer",
        requiresConfirmation: false,
        schedule: {
          mode: "auto",
          totalAmountCents: 3000,
          installmentsCount: 3,
          firstDueDate: "2026-07-10",
        },
      }),
    })
  );
  const contractId = (await created.json()).id as string;
  const detail = await app.handle(
    new Request(`http://localhost/api/contracts/${contractId}`, {
      headers: { cookie },
    })
  );
  const installmentId = (await detail.json()).installments[0].id as string;
  await app.handle(
    new Request(
      `http://localhost/api/installments/${installmentId}/mark-paid`,
      { method: "POST", headers: { cookie } }
    )
  );
  return { contractId, installmentId };
}

describe("receipt_share schema", () => {
  it("impede dois shares ativos na mesma parcela", async () => {
    const cookie = await signUpCookie(uniqueEmail("rs-idx"));
    const { installmentId } = await createPaidInstallment(cookie);
    const [inst] = await db
      .select()
      .from(installment)
      .where(eq(installment.id, installmentId));
    expect(inst?.status).toBe("paid");
    const [owner] = await db
      .select({ ownerId: contract.ownerId })
      .from(contract)
      .where(eq(contract.id, inst?.contractId as string));
    const createdByUserId = owner?.ownerId as string;

    await db
      .insert(receiptShare)
      .values({ installmentId, token: `t1-${installmentId}`, createdByUserId });
    await expect(
      (async () =>
        db.insert(receiptShare).values({
          installmentId,
          token: `t2-${installmentId}`,
          createdByUserId,
        }))()
    ).rejects.toThrow();

    // revogado não conta: um novo ativo é permitido
    await db
      .update(receiptShare)
      .set({ revokedAt: new Date() })
      .where(eq(receiptShare.installmentId, installmentId));
    await db
      .insert(receiptShare)
      .values({ installmentId, token: `t3-${installmentId}`, createdByUserId });
  });
});

function shareReq(
  method: "GET" | "POST" | "DELETE",
  installmentId: string,
  cookie: string
) {
  return app.handle(
    new Request(
      `http://localhost/api/installments/${installmentId}/receipt-share`,
      { method, headers: { cookie } }
    )
  );
}

describe("receipt-share (dono)", () => {
  it("POST cria e é idempotente; GET devolve o ativo", async () => {
    const cookie = await signUpCookie(uniqueEmail("rs-own"));
    const { installmentId } = await createPaidInstallment(cookie);

    expect(
      await (await shareReq("GET", installmentId, cookie)).json()
    ).toBeNull();

    const r1 = await shareReq("POST", installmentId, cookie);
    expect(r1.status).toBe(200);
    const a = (await r1.json()) as { token: string; createdAt: string };
    expect(a.token).toMatch(SHARE_TOKEN_RE);

    const b = await (await shareReq("POST", installmentId, cookie)).json();
    expect(b.token).toBe(a.token);
    expect(
      (await (await shareReq("GET", installmentId, cookie)).json()).token
    ).toBe(a.token);
  });

  it("POST concorrente resulta em um único share", async () => {
    const cookie = await signUpCookie(uniqueEmail("rs-race"));
    const { installmentId } = await createPaidInstallment(cookie);
    const [x, y] = await Promise.all([
      shareReq("POST", installmentId, cookie),
      shareReq("POST", installmentId, cookie),
    ]);
    expect(x.status).toBe(200);
    expect(y.status).toBe(200);
    expect((await x.json()).token).toBe((await y.json()).token);
  });

  it("DELETE revoga; POST seguinte gera token novo; DELETE repetido é 204", async () => {
    const cookie = await signUpCookie(uniqueEmail("rs-rev"));
    const { installmentId } = await createPaidInstallment(cookie);
    const a = await (await shareReq("POST", installmentId, cookie)).json();
    expect((await shareReq("DELETE", installmentId, cookie)).status).toBe(204);
    expect((await shareReq("DELETE", installmentId, cookie)).status).toBe(204);
    expect(
      await (await shareReq("GET", installmentId, cookie)).json()
    ).toBeNull();
    const b = await (await shareReq("POST", installmentId, cookie)).json();
    expect(b.token).not.toBe(a.token);
  });

  it("parcela não paga → 409", async () => {
    const cookie = await signUpCookie(uniqueEmail("rs-409"));
    const { installmentId } = await createPaidInstallment(cookie);
    await db
      .update(installment)
      .set({ status: "pending", paidAt: null })
      .where(eq(installment.id, installmentId));
    expect((await shareReq("POST", installmentId, cookie)).status).toBe(409);
  });

  it("outro usuário (sem acesso) → 404 nas três rotas", async () => {
    const owner = await signUpCookie(uniqueEmail("rs-o"));
    const stranger = await signUpCookie(uniqueEmail("rs-s"));
    const { installmentId } = await createPaidInstallment(owner);
    for (const m of ["GET", "POST", "DELETE"] as const) {
      expect((await shareReq(m, installmentId, stranger)).status).toBe(404);
    }
  });

  it("participante vinculado que não é dono → 404", async () => {
    const owner = await signUpCookie(uniqueEmail("rs-o2"));
    const sellerEmail = uniqueEmail("rs-seller");
    const seller = await signUpCookie(sellerEmail);
    const { contractId, installmentId } = await createPaidInstallment(owner);
    const add = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner },
        body: JSON.stringify({ displayName: "Vendedor", role: "seller" }),
      })
    );
    const participantId = (await add.json()).id as string;
    const inv = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/${participantId}/invite`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: owner },
          body: JSON.stringify({ email: sellerEmail }),
        }
      )
    );
    const { token } = (await inv.json()) as { token: string };
    const accept = await app.handle(
      new Request(`http://localhost/api/invites/${token}/accept`, {
        method: "POST",
        headers: { cookie: seller },
      })
    );
    expect(accept.status).toBe(200);
    expect((await shareReq("POST", installmentId, seller)).status).toBe(404);
  });

  it("registra auditoria ao criar e revogar", async () => {
    const cookie = await signUpCookie(uniqueEmail("rs-audit"));
    const { installmentId } = await createPaidInstallment(cookie);
    await shareReq("POST", installmentId, cookie);
    await shareReq("POST", installmentId, cookie); // idempotente: não duplica evento
    await shareReq("DELETE", installmentId, cookie);
    const rows = await db
      .select({ type: auditEvent.type })
      .from(auditEvent)
      .where(eq(auditEvent.installmentId, installmentId));
    const types = rows.map((r) => r.type);
    expect(types.filter((t) => t === "receipt_share_created")).toHaveLength(1);
    expect(types.filter((t) => t === "receipt_share_revoked")).toHaveLength(1);
  });
});

function publicReq(path: string) {
  return app.handle(
    new Request(`http://localhost/api/public/receipts/${path}`)
  );
}

describe("recibo público", () => {
  it("devolve só as chaves permitidas, sem cache e noindex", async () => {
    const cookie = await signUpCookie(uniqueEmail("rs-pub"));
    const { installmentId } = await createPaidInstallment(cookie);
    const { token } = await (
      await shareReq("POST", installmentId, cookie)
    ).json();

    const res = await publicReq(token);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(
      [
        "amountCents",
        "contractTitle",
        "installmentsCount",
        "paidAt",
        "payerName",
        "receiverName",
        "sequence",
      ].sort()
    );
    expect(body.contractTitle).toBe("Aluguel & cia");
    expect(body.sequence).toBe(1);
    expect(body.installmentsCount).toBe(3);
    expect(body.paidAt).toMatch(ISO_DATE_RE);
  });

  it("PDF público responde 200 com %PDF", async () => {
    const cookie = await signUpCookie(uniqueEmail("rs-pdf"));
    const { installmentId } = await createPaidInstallment(cookie);
    const { token } = await (
      await shareReq("POST", installmentId, cookie)
    ).json();
    const res = await publicReq(`${token}/receipt.pdf`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
  });

  it("token inexistente, revogado ou parcela não-paga → 404 (JSON e PDF)", async () => {
    const missing = await publicReq("nao-existe");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
    expect(missing.headers.get("x-robots-tag")).toBe("noindex");
    const missingPdf = await publicReq("nao-existe/receipt.pdf");
    expect(missingPdf.status).toBe(404);
    expect(missingPdf.headers.get("cache-control")).toBe("no-store");
    expect(missingPdf.headers.get("x-robots-tag")).toBe("noindex");

    const cookie = await signUpCookie(uniqueEmail("rs-404"));
    const { installmentId } = await createPaidInstallment(cookie);
    const { token } = await (
      await shareReq("POST", installmentId, cookie)
    ).json();

    await db
      .update(installment)
      .set({ status: "pending", paidAt: null })
      .where(eq(installment.id, installmentId));
    expect((await publicReq(token)).status).toBe(404);
    expect((await publicReq(`${token}/receipt.pdf`)).status).toBe(404);

    // volta a paga → o MESMO token funciona de novo
    await db
      .update(installment)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(installment.id, installmentId));
    expect((await publicReq(token)).status).toBe(200);

    await shareReq("DELETE", installmentId, cookie);
    expect((await publicReq(token)).status).toBe(404);
  });
});
