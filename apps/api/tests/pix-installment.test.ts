import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { installment, user as userTable } from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

const CRC_SUFFIX_RE = /6304[0-9A-F]{4}$/;

async function createContract(cookie: string, ownerRole: "buyer" | "seller") {
  const res = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "Contrato PIX",
        ownerRole,
        requiresConfirmation: false,
        schedule: {
          mode: "auto",
          totalAmountCents: 300_000,
          installmentsCount: 3,
          firstDueDate: "2026-08-10",
        },
      }),
    })
  );
  return (await res.json()).id as string;
}

async function firstInstallmentId(cookie: string, contractId: string) {
  const res = await app.handle(
    new Request(`http://localhost/api/contracts/${contractId}`, {
      headers: { cookie },
    })
  );
  const body = await res.json();
  return body.installments[0].id as string;
}

async function getInstallment(cookie: string, id: string) {
  const res = await app.handle(
    new Request(`http://localhost/api/installments/${id}`, {
      headers: { cookie },
    })
  );
  return res.json();
}

async function setProfilePix(cookie: string, pixKey: string) {
  await app.handle(
    new Request("http://localhost/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ pixKey }),
    })
  );
}

describe("GET /installments/:id → pix (gate)", () => {
  it("seller + chave no perfil + parcela pendente → pix presente com CRC válido", async () => {
    const cookie = await signUpCookie(uniqueEmail("pixinst"));
    await setProfilePix(cookie, "joao@example.com");
    const id = await createContract(cookie, "seller");
    const inst = await firstInstallmentId(cookie, id);
    const detail = await getInstallment(cookie, inst);
    expect(detail.pix).not.toBeNull();
    expect(detail.pix.keyType).toBe("email");
    expect(detail.pix.copiaECola).toMatch(CRC_SUFFIX_RE);
    expect(detail.pix.copiaECola).toContain("joao@example.com");
  });

  it("buyer → pix null (quem recebe seria a contraparte)", async () => {
    const cookie = await signUpCookie(uniqueEmail("pixbuyer"));
    await setProfilePix(cookie, "joao@example.com");
    const id = await createContract(cookie, "buyer");
    const inst = await firstInstallmentId(cookie, id);
    expect((await getInstallment(cookie, inst)).pix).toBeNull();
  });

  it("sem chave → pix null", async () => {
    const cookie = await signUpCookie(uniqueEmail("pixnokey"));
    const id = await createContract(cookie, "seller");
    const inst = await firstInstallmentId(cookie, id);
    expect((await getInstallment(cookie, inst)).pix).toBeNull();
  });

  it("override do contrato vence o default do perfil", async () => {
    const cookie = await signUpCookie(uniqueEmail("pixoverride"));
    await setProfilePix(cookie, "perfil@example.com");
    const id = await createContract(cookie, "seller");
    await app.handle(
      new Request(`http://localhost/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ pixKey: "override@example.com" }),
      })
    );
    const inst = await firstInstallmentId(cookie, id);
    const detail = await getInstallment(cookie, inst);
    expect(detail.pix.copiaECola).toContain("override@example.com");
    expect(detail.pix.copiaECola).not.toContain("perfil@example.com");
  });

  it("seller + chave no perfil + parcela paga → pix null", async () => {
    const cookie = await signUpCookie(uniqueEmail("pixpaid"));
    await setProfilePix(cookie, "joao@example.com");
    const id = await createContract(cookie, "seller");
    const inst = await firstInstallmentId(cookie, id);
    expect((await getInstallment(cookie, inst)).pix).not.toBeNull();

    await db
      .update(installment)
      .set({ status: "paid" })
      .where(eq(installment.id, inst));
    expect((await getInstallment(cookie, inst)).pix).toBeNull();
  });

  it("seller + chave no perfil + parcela confirmada → pix null", async () => {
    const cookie = await signUpCookie(uniqueEmail("pixconfirmed"));
    await setProfilePix(cookie, "joao@example.com");
    const id = await createContract(cookie, "seller");
    const inst = await firstInstallmentId(cookie, id);
    expect((await getInstallment(cookie, inst)).pix).not.toBeNull();

    await db
      .update(installment)
      .set({ status: "confirmed" })
      .where(eq(installment.id, inst));
    expect((await getInstallment(cookie, inst)).pix).toBeNull();
  });

  it("chave armazenada malformada → pix null, sem 500 (guarda de robustez)", async () => {
    const email = uniqueEmail("pixmalformed");
    const cookie = await signUpCookie(email);
    await setProfilePix(cookie, "joao@example.com");
    const id = await createContract(cookie, "seller");
    const inst = await firstInstallmentId(cookie, id);

    // força uma chave inesperadamente inválida direto no banco (bypassa a
    // validação de escrita) para provar que o GET não derruba o detalhe.
    await db
      .update(userTable)
      .set({ pixKey: "###GARBAGE###" })
      .where(eq(userTable.email, email));

    const res = await app.handle(
      new Request(`http://localhost/api/installments/${inst}`, {
        headers: { cookie },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pix).toBeNull();
  });
});
