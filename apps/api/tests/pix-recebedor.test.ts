import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { participant, user as userTable } from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

const PIX_CRC_SUFFIX = /6304[0-9A-F]{4}$/;

async function createContract(cookie: string, ownerRole: "buyer" | "seller") {
  const res = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "G2",
        ownerRole,
        requiresConfirmation: false,
        schedule: {
          mode: "auto",
          totalAmountCents: 300_000,
          installmentsCount: 3,
          firstDueDate: "2026-09-10",
        },
      }),
    })
  );
  return (await res.json()).id as string;
}

async function firstInstallment(cookie: string, contractId: string) {
  const res = await app.handle(
    new Request(`http://localhost/api/contracts/${contractId}`, {
      headers: { cookie },
    })
  );
  return (await res.json()).installments[0].id as string;
}

async function detail(cookie: string, contractId: string) {
  const installmentId = await firstInstallment(cookie, contractId);
  const res = await app.handle(
    new Request(`http://localhost/api/installments/${installmentId}`, {
      headers: { cookie },
    })
  );
  return res.json();
}

function setProfilePix(cookie: string, pixKey: string) {
  return app.handle(
    new Request("http://localhost/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ pixKey }),
    })
  );
}

describe("PIX do recebedor", () => {
  it("dono comprador usa a chave e o nome do vendedor linkado", async () => {
    const sellerEmail = uniqueEmail("g2-seller");
    const sellerCookie = await signUpCookie(sellerEmail);
    await setProfilePix(sellerCookie, "vendedor@example.com");
    const [seller] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, sellerEmail))
      .limit(1);
    const ownerCookie = await signUpCookie(uniqueEmail("g2-owner"));
    const contractId = await createContract(ownerCookie, "buyer");
    await db.insert(participant).values({
      contractId,
      displayName: "Maria Vendedora",
      role: "seller",
      linkedUserId: seller?.id,
    });

    const result = await detail(ownerCookie, contractId);
    expect(result.pix.copiaECola).toContain("vendedor@example.com");
    expect(result.pix.payToName).toBe("Maria Vendedora");
    expect(result.pix.copiaECola).toMatch(PIX_CRC_SUFFIX);
  });

  it("fica sem PIX quando vendedor não tem conta nem override", async () => {
    const ownerCookie = await signUpCookie(uniqueEmail("g2-nolink"));
    const contractId = await createContract(ownerCookie, "buyer");
    await db.insert(participant).values({
      contractId,
      displayName: "Contato Sem Conta",
      role: "seller",
      linkedUserId: null,
    });
    expect((await detail(ownerCookie, contractId)).pix).toBeNull();
  });

  it("override vence e mantém o nome do contato", async () => {
    const ownerCookie = await signUpCookie(uniqueEmail("g2-override"));
    const contractId = await createContract(ownerCookie, "buyer");
    await db.insert(participant).values({
      contractId,
      displayName: "João Recebe",
      role: "seller",
      linkedUserId: null,
    });
    await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({ pixKey: "joao@example.com" }),
      })
    );
    const result = await detail(ownerCookie, contractId);
    expect(result.pix.copiaECola).toContain("joao@example.com");
    expect(result.pix.payToName).toBe("João Recebe");
  });

  it("dono vendedor continua usando a própria chave e nome", async () => {
    const ownerCookie = await signUpCookie(uniqueEmail("g2-seller-owner"));
    await setProfilePix(ownerCookie, "dono@example.com");
    const result = await detail(
      ownerCookie,
      await createContract(ownerCookie, "seller")
    );
    expect(result.pix.copiaECola).toContain("dono@example.com");
    expect(typeof result.pix.payToName).toBe("string");
  });
});
