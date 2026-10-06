import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { participant, user } from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

function call(cookie: string, path: string, method = "GET", body?: unknown) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
}

/** The owner pays (buyer); "Helena Duarte" receives, as a contact with no account. */
async function payingToContact() {
  const owner = await signUpCookie(uniqueEmail("contact-owner"));
  const created = await call(owner, "/api/contracts", "POST", {
    title: "Aluguel da sala",
    ownerRole: "buyer",
    requiresConfirmation: false,
    schedule: {
      mode: "auto",
      totalAmountCents: 360_000,
      installmentsCount: 2,
      firstDueDate: "2026-10-03",
    },
  });
  const { id: contractId } = (await created.json()) as { id: string };
  const [contact] = await db
    .insert(participant)
    .values({ contractId, displayName: "Helena Duarte", role: "seller" })
    .returning({ id: participant.id });
  const detail = await (
    await call(owner, `/api/contracts/${contractId}`)
  ).json();
  return {
    owner,
    contractId,
    contactId: contact?.id as string,
    installmentId: detail.installments[0].id as string,
  };
}

function saveKey(
  cookie: string,
  contractId: string,
  participantId: string,
  pixKey: string | null
) {
  return call(
    cookie,
    `/api/contracts/${contractId}/participants/${participantId}/pix-key`,
    "PATCH",
    { pixKey }
  );
}

describe("PIX guardado no contato", () => {
  it("sem chave: pix nulo, pixMissing e o id do contato para guardar", async () => {
    const s = await payingToContact();
    const body = await (
      await call(s.owner, `/api/installments/${s.installmentId}`)
    ).json();
    expect(body.pix).toBeNull();
    expect(body.pixMissing).toBe(true);
    expect(body.receiver).toEqual({
      name: "Helena Duarte",
      hasAccount: false,
      contactParticipantId: s.contactId,
    });
  });

  it("o dono guarda a chave do contato, e o painel paga com ela (source contact)", async () => {
    const s = await payingToContact();
    const res = await saveKey(
      s.owner,
      s.contractId,
      s.contactId,
      "helena.duarte@exemplo.com"
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: s.contactId,
      pixKey: "helena.duarte@exemplo.com",
    });
    const body = await (
      await call(s.owner, `/api/installments/${s.installmentId}`)
    ).json();
    expect(body.pixMissing).toBe(false);
    expect(body.pix).toMatchObject({
      key: "helena.duarte@exemplo.com",
      keyType: "email",
      source: "contact",
      payToName: "Helena Duarte",
    });
  });

  it("chave inválida: 422; null limpa", async () => {
    const s = await payingToContact();
    expect(
      (await saveKey(s.owner, s.contractId, s.contactId, "xxx")).status
    ).toBe(422);
    await saveKey(
      s.owner,
      s.contractId,
      s.contactId,
      "helena.duarte@exemplo.com"
    );
    expect(
      await (await saveKey(s.owner, s.contractId, s.contactId, null)).json()
    ).toEqual({ id: s.contactId, pixKey: null });
  });

  it("com conta, vale a da conta: guardar no contato dá 422", async () => {
    const s = await payingToContact();
    const email = uniqueEmail("contact-linked");
    await signUpCookie(email);
    const [linked] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    await db
      .update(participant)
      .set({ linkedUserId: linked?.id as string })
      .where(eq(participant.id, s.contactId));
    expect(
      (
        await saveKey(
          s.owner,
          s.contractId,
          s.contactId,
          "helena.duarte@exemplo.com"
        )
      ).status
    ).toBe(422);
  });

  it("quem não é dono não guarda (403 ou 404)", async () => {
    const s = await payingToContact();
    const other = await signUpCookie(uniqueEmail("contact-other"));
    expect([403, 404]).toContain(
      (await saveKey(other, s.contractId, s.contactId, "x@example.com")).status
    );
  });
});
