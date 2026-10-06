import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { auditEvent, user } from "../src/db/schema";
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

/** João receives (seller, owner, key on the account); Rafael is invited to pay and accepts; Sílvia is invited to watch. */
async function scenario() {
  const ownerEmail = uniqueEmail("detail-joao");
  const owner = await signUpCookie(ownerEmail);
  await call(owner, "/api/me", "PATCH", { pixKey: "joao.souza@exemplo.com" });
  const created = await call(owner, "/api/contracts", "POST", {
    title: "Moto do Rafa",
    ownerRole: "seller",
    requiresConfirmation: true,
    schedule: {
      mode: "auto",
      totalAmountCents: 96_000,
      installmentsCount: 2,
      firstDueDate: "2026-08-30",
    },
  });
  const { id } = (await created.json()) as { id: string };
  const payerEmail = uniqueEmail("detail-rafa");
  const payer = await signUpCookie(payerEmail);
  const rafa = await (
    await call(owner, `/api/contracts/${id}/participants`, "POST", {
      displayName: "Rafael Prado",
      role: "buyer",
    })
  ).json();
  const { token } = await (
    await call(
      owner,
      `/api/contracts/${id}/participants/${rafa.id}/invite`,
      "POST",
      { email: payerEmail }
    )
  ).json();
  await call(payer, `/api/invites/${token}/accept`, "POST");
  const silvia = await (
    await call(owner, `/api/contracts/${id}/participants`, "POST", {
      displayName: "Sílvia Souza",
      role: "viewer",
    })
  ).json();
  await call(
    owner,
    `/api/contracts/${id}/participants/${silvia.id}/invite`,
    "POST",
    { email: "silvia.souza@exemplo.com" }
  );
  return { owner, ownerEmail, payer, payerEmail, id };
}

describe("GET /contracts/:id (Fase 2)", () => {
  it("o dono vê os e-mails, o link do convite, quem recebe com a chave e a criação", async () => {
    const s = await scenario();
    const body = await (await call(s.owner, `/api/contracts/${s.id}`)).json();
    expect(
      body.participants.map((p: { displayName: string }) => p.displayName)
    ).toEqual(["Test", "Rafael Prado", "Sílvia Souza"]);
    const [me, rafa, silvia] = body.participants;
    expect(me).toMatchObject({
      isMe: true,
      isOwner: true,
      email: s.ownerEmail,
    });
    expect(rafa).toMatchObject({
      linked: true,
      email: s.payerEmail,
      invite: null,
    });
    expect(typeof rafa.joinedAt).toBe("string");
    expect(silvia.invite.status).toBe("pending");
    expect(silvia.invite.url).toContain("/invites/");
    expect(body.receiver).toMatchObject({
      hasAccount: true,
      contactParticipantId: null,
      pix: {
        key: "joao.souza@exemplo.com",
        keyType: "email",
        source: "account",
      },
    });
    expect(typeof body.contract.createdAt).toBe("string");
    expect(body.contract.ownerName).toBe("Test");
    expect(body.installments[0]).toHaveProperty("paidAt", null);
  });

  it("não dono: e-mail só o próprio, nenhum link de convite; o aceite virou evento", async () => {
    const s = await scenario();
    const body = await (await call(s.payer, `/api/contracts/${s.id}`)).json();
    const [owner, me, silvia] = body.participants;
    expect(owner.email).toBeNull();
    expect(me).toMatchObject({ isMe: true, email: s.payerEmail });
    expect(silvia.email).toBeNull();
    expect(silvia.invite.url).toBeNull();
    expect(body.recentEvents.map((e: { type: string }) => e.type)).toEqual([
      "participant_joined",
      "contract_created",
    ]);
    expect(body.recentEvents[0].metadata).toEqual({
      participantName: "Rafael Prado",
      role: "buyer",
    });
  });

  it("o espectador não recebe a chave de quem recebe", async () => {
    const s = await scenario();
    const viewerEmail = uniqueEmail("detail-viewer");
    const viewer = await signUpCookie(viewerEmail);
    const p = await (
      await call(s.owner, `/api/contracts/${s.id}/participants`, "POST", {
        displayName: "Marcos Prado",
        role: "viewer",
      })
    ).json();
    const { token } = await (
      await call(
        s.owner,
        `/api/contracts/${s.id}/participants/${p.id}/invite`,
        "POST",
        { email: viewerEmail }
      )
    ).json();
    await call(viewer, `/api/invites/${token}/accept`, "POST");
    const body = await (await call(viewer, `/api/contracts/${s.id}`)).json();
    expect(body.role).toBe("viewer");
    expect(body.receiver.pix).toBeNull();
  });
});

describe("GET /contracts/:id/events", () => {
  it("pagina do mais novo para o mais antigo, sem perder empatados, e termina na criação", async () => {
    const s = await scenario();
    const [joao] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, s.ownerEmail))
      .limit(1);
    // All 51 in the same instant (a day ago): only the id can order them across the page break (M1).
    const sameInstant = new Date(Date.now() - 86_400_000);
    await db.insert(auditEvent).values(
      Array.from({ length: 51 }, () => ({
        contractId: s.id,
        actorUserId: joao?.id as string,
        type: "receipt_share_created",
        createdAt: sameInstant,
      }))
    );
    const first = await (
      await call(s.owner, `/api/contracts/${s.id}/events`)
    ).json();
    expect(first.items).toHaveLength(50);
    expect(first.items[0].type).toBe("participant_joined");
    expect(typeof first.nextBefore).toBe("string");
    const second = await (
      await call(
        s.owner,
        `/api/contracts/${s.id}/events?before=${encodeURIComponent(first.nextBefore)}`
      )
    ).json();
    expect(second.items.at(-1).type).toBe("contract_created");
    expect(second.nextBefore).toBeNull();
    expect(first.items.length + second.items.length).toBe(53);
  });

  it("sem acesso: 404", async () => {
    const s = await scenario();
    const stranger = await signUpCookie(uniqueEmail("detail-stranger"));
    expect((await call(stranger, `/api/contracts/${s.id}/events`)).status).toBe(
      404
    );
  });
});

describe("PATCH /contracts/:id (título e descrição)", () => {
  it("o dono troca o título e limpa a descrição", async () => {
    const s = await scenario();
    const res = await call(s.owner, `/api/contracts/${s.id}`, "PATCH", {
      title: "Moto CG do Rafa",
      description: null,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: s.id,
      title: "Moto CG do Rafa",
      description: null,
    });
  });

  it("quem não é dono não edita (403)", async () => {
    const s = await scenario();
    expect(
      (
        await call(s.payer, `/api/contracts/${s.id}`, "PATCH", {
          title: "Outro",
        })
      ).status
    ).toBe(403);
  });
});
