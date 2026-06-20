import { describe, expect, it } from "bun:test";
import { NOTIFICATION_TYPE } from "@quitto/shared";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { invite, notification } from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

async function createContract(cookie: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "Contrato Teste",
        ownerRole: "buyer",
        requiresConfirmation: true,
        schedule: {
          mode: "auto",
          totalAmountCents: 3000,
          installmentsCount: 3,
          firstDueDate: "2026-07-10",
        },
      }),
    })
  );
  const body = await res.json();
  return body.id as string;
}

async function setupInvite(
  ownerCookie: string,
  inviteeEmail: string
): Promise<{ contractId: string; token: string }> {
  const contractId = await createContract(ownerCookie);

  const addRes = await app.handle(
    new Request(`http://localhost/api/contracts/${contractId}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({ displayName: "Convidado", role: "seller" }),
    })
  );
  const { id: participantId } = await addRes.json();

  const invRes = await app.handle(
    new Request(
      `http://localhost/api/contracts/${contractId}/participants/${participantId}/invite`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({ email: inviteeEmail }),
      }
    )
  );
  const inv = await invRes.json();
  return { contractId, token: inv.token as string };
}

describe("invites", () => {
  it("aceita quando o e-mail bate e vincula o participante", async () => {
    const ts = Date.now();
    const ownerEmail = `own-acc-${ts}@example.com`;
    const inviteeEmail = `friend-acc-${ts}@example.com`;
    const owner = await signUpCookie(ownerEmail);
    const { contractId, token } = await setupInvite(owner, inviteeEmail);
    const invitee = await signUpCookie(inviteeEmail);

    const acc = await app.handle(
      new Request(`http://localhost/api/invites/${token}/accept`, {
        method: "POST",
        headers: { cookie: invitee },
      })
    );
    expect(acc.status).toBe(200);
    const body = await acc.json();
    expect(body.contractId).toBe(contractId);

    // Participante vinculado deve conseguir acessar o detalhe do contrato
    const detail = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}`, {
        headers: { cookie: invitee },
      })
    );
    expect(detail.status).toBe(200);
  });

  it("recusa quando o e-mail não bate (403)", async () => {
    const ts = Date.now();
    const ownerEmail = `own-mis-${ts}@example.com`;
    const targetEmail = `target-mis-${ts}@example.com`;
    const otherEmail = `other-mis-${ts}@example.com`;
    const owner = await signUpCookie(ownerEmail);
    const { token } = await setupInvite(owner, targetEmail);
    const other = await signUpCookie(otherEmail);

    const acc = await app.handle(
      new Request(`http://localhost/api/invites/${token}/accept`, {
        method: "POST",
        headers: { cookie: other },
      })
    );
    expect(acc.status).toBe(403);
  });

  it("recusa reuso (422)", async () => {
    const ts = Date.now();
    const ownerEmail = `own-reuse-${ts}@example.com`;
    const inviteeEmail = `reuse-${ts}@example.com`;
    const owner = await signUpCookie(ownerEmail);
    const { token } = await setupInvite(owner, inviteeEmail);
    const invitee = await signUpCookie(inviteeEmail);

    // Primeira aceitação — deve funcionar
    const first = await app.handle(
      new Request(`http://localhost/api/invites/${token}/accept`, {
        method: "POST",
        headers: { cookie: invitee },
      })
    );
    expect(first.status).toBe(200);

    // Segunda aceitação — deve falhar com 422
    const again = await app.handle(
      new Request(`http://localhost/api/invites/${token}/accept`, {
        method: "POST",
        headers: { cookie: invitee },
      })
    );
    expect(again.status).toBe(422);
  });

  // ─── Guard: já participa do contrato (dono/duplicado) ────────────────────

  it("dono não pode aceitar convite para o próprio contrato (403)", async () => {
    const ts = Date.now();
    const ownerEmail = `own-self-${ts}@example.com`;
    const owner = await signUpCookie(ownerEmail);
    // Convite cujo e-mail é o do PRÓPRIO dono.
    const { token } = await setupInvite(owner, ownerEmail);

    const acc = await app.handle(
      new Request(`http://localhost/api/invites/${token}/accept`, {
        method: "POST",
        headers: { cookie: owner },
      })
    );
    expect(acc.status).toBe(403);
  });

  it("quem já participa não pode aceitar um segundo convite (403)", async () => {
    const ts = Date.now();
    const ownerEmail = `own-dup-${ts}@example.com`;
    const inviteeEmail = `dup-${ts}@example.com`;
    const owner = await signUpCookie(ownerEmail);
    const { contractId, token } = await setupInvite(owner, inviteeEmail);
    const invitee = await signUpCookie(inviteeEmail);

    // userB aceita o primeiro convite e vira participante.
    const first = await app.handle(
      new Request(`http://localhost/api/invites/${token}/accept`, {
        method: "POST",
        headers: { cookie: invitee },
      })
    );
    expect(first.status).toBe(200);

    // Cria uma SEGUNDA vaga + convite para o mesmo e-mail no mesmo contrato.
    // viewer é ilimitado por contrato (seller já está ocupado pela 1ª vaga).
    const addRes = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner },
        body: JSON.stringify({ displayName: "Convidado 2", role: "viewer" }),
      })
    );
    const { id: participantId2 } = await addRes.json();
    const invRes = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/${participantId2}/invite`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: owner },
          body: JSON.stringify({ email: inviteeEmail }),
        }
      )
    );
    const { token: token2 } = await invRes.json();

    const acc2 = await app.handle(
      new Request(`http://localhost/api/invites/${token2}/accept`, {
        method: "POST",
        headers: { cookie: invitee },
      })
    );
    expect(acc2.status).toBe(403);
  });

  it("vaga já vinculada não pode ser aceita de novo (422)", async () => {
    const ts = Date.now();
    const ownerEmail = `own-slot-${ts}@example.com`;
    const inviteeEmail = `slot-${ts}@example.com`;
    const owner = await signUpCookie(ownerEmail);
    const contractId = await createContract(owner);

    // Uma única vaga, com DOIS convites para o mesmo e-mail.
    const addRes = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner },
        body: JSON.stringify({ displayName: "Convidado Slot", role: "seller" }),
      })
    );
    const { id: participantId } = await addRes.json();

    const inv1 = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/${participantId}/invite`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: owner },
          body: JSON.stringify({ email: inviteeEmail }),
        }
      )
    );
    const { token: tokenA } = await inv1.json();
    const inv2 = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/${participantId}/invite`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: owner },
          body: JSON.stringify({ email: inviteeEmail }),
        }
      )
    );
    const { token: tokenB } = await inv2.json();

    const invitee = await signUpCookie(inviteeEmail);

    const first = await app.handle(
      new Request(`http://localhost/api/invites/${tokenA}/accept`, {
        method: "POST",
        headers: { cookie: invitee },
      })
    );
    expect(first.status).toBe(200);

    // O segundo convite aponta para a MESMA vaga, agora já vinculada.
    // O guard de "já participa" (403) dispara antes do "vaga vinculada" (422),
    // pois o usuário virou participante no primeiro aceite. Ambos bloqueiam.
    const second = await app.handle(
      new Request(`http://localhost/api/invites/${tokenB}/accept`, {
        method: "POST",
        headers: { cookie: invitee },
      })
    );
    expect([403, 422]).toContain(second.status);
  });

  it("GET convite: alreadyParticipant=true quando já participa do contrato", async () => {
    const ts = Date.now();
    const ownerEmail = `own-ap-${ts}@example.com`;
    const owner = await signUpCookie(ownerEmail);
    // Convite para o próprio dono → ele já participa (slot ligado ao ownerId).
    const { token } = await setupInvite(owner, ownerEmail);

    const res = await app.handle(
      new Request(`http://localhost/api/invites/${token}`, {
        headers: { cookie: owner },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyParticipant).toBe(true);
    expect(body.emailMatches).toBe(true);
  });

  // ─── Gap 1: GET /api/invites/:token (view) ───────────────────────────────

  it("GET convite: emailMatches=true quando e-mail bate (200)", async () => {
    const ts = Date.now();
    const ownerEmail = `own-view-match-${ts}@example.com`;
    const inviteeEmail = `invitee-view-match-${ts}@example.com`;
    const owner = await signUpCookie(ownerEmail);
    const { token } = await setupInvite(owner, inviteeEmail);
    const invitee = await signUpCookie(inviteeEmail);

    const res = await app.handle(
      new Request(`http://localhost/api/invites/${token}`, {
        headers: { cookie: invitee },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.emailMatches).toBe(true);
    expect(typeof body.contractTitle).toBe("string");
    expect(body.contractTitle.length).toBeGreaterThan(0);
    expect(body.email).toBe(inviteeEmail.toLowerCase());
    expect(typeof body.role).toBe("string");
  });

  it("GET convite: emailMatches=false quando e-mail não bate (200)", async () => {
    const ts = Date.now();
    const ownerEmail = `own-view-nomatch-${ts}@example.com`;
    const targetEmail = `target-view-nomatch-${ts}@example.com`;
    const otherEmail = `other-view-nomatch-${ts}@example.com`;
    const owner = await signUpCookie(ownerEmail);
    const { token } = await setupInvite(owner, targetEmail);
    const other = await signUpCookie(otherEmail);

    const res = await app.handle(
      new Request(`http://localhost/api/invites/${token}`, {
        headers: { cookie: other },
      })
    );
    // The view endpoint returns 200 for any authenticated user; only accept is hard-locked.
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.emailMatches).toBe(false);
  });

  it("GET convite: sem autenticação → 401", async () => {
    const ts = Date.now();
    const ownerEmail = `own-view-unauth-${ts}@example.com`;
    const inviteeEmail = `invitee-view-unauth-${ts}@example.com`;
    const owner = await signUpCookie(ownerEmail);
    const { token } = await setupInvite(owner, inviteeEmail);

    const res = await app.handle(
      new Request(`http://localhost/api/invites/${token}`)
    );
    expect(res.status).toBe(401);
  });

  // ─── Gap 2: convite expirado → 422 ───────────────────────────────────────

  it("convite expirado retorna 422 ao aceitar", async () => {
    const ts = Date.now();
    const ownerEmail = `own-exp-${ts}@example.com`;
    const inviteeEmail = `invitee-exp-${ts}@example.com`;
    const owner = await signUpCookie(ownerEmail);

    // Cria contrato + participante + convite válido via helpers para garantir FKs corretas.
    const contractId = await createContract(owner);

    const addRes = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner },
        body: JSON.stringify({ displayName: "Convidado Exp", role: "seller" }),
      })
    );
    const { id: participantId } = await addRes.json();

    // Insere diretamente um convite já expirado (expiresAt no passado).
    const expiredToken = `expired-${ts}`;
    await db.insert(invite).values({
      contractId,
      participantId,
      email: inviteeEmail.toLowerCase(),
      token: expiredToken,
      expiresAt: new Date(Date.now() - 1000),
    });

    const invitee = await signUpCookie(inviteeEmail);

    const acc = await app.handle(
      new Request(`http://localhost/api/invites/${expiredToken}/accept`, {
        method: "POST",
        headers: { cookie: invitee },
      })
    );
    expect(acc.status).toBe(422);
  });

  // ─── Fase 4b: GET /api/invites/mine ──────────────────────────────────────

  it("GET /invites/mine lista convites pendentes do e-mail da sessão", async () => {
    const ts = Date.now();
    const owner = await signUpCookie(`mine-own-${ts}@e.com`);
    const inviteeEmail = `mine-friend-${ts}@e.com`;
    const { contractId } = await setupInvite(owner, inviteeEmail);
    const invitee = await signUpCookie(inviteeEmail);

    const res = await app.handle(
      new Request("http://localhost/api/invites/mine", {
        headers: { cookie: invitee },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].contractTitle).toBe("Contrato Teste");
    expect(body[0].role).toBe("seller");
    expect(typeof body[0].token).toBe("string");
    expect(contractId).toBeTruthy();
  });

  it("GET /invites/mine não retorna convites de outro e-mail", async () => {
    const ts = Date.now();
    const owner = await signUpCookie(`mine-own2-${ts}@e.com`);
    await setupInvite(owner, `mine-target-${ts}@e.com`);
    const other = await signUpCookie(`mine-other-${ts}@e.com`);

    const res = await app.handle(
      new Request("http://localhost/api/invites/mine", {
        headers: { cookie: other },
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).length).toBe(0);
  });

  it("GET /invites/mine exclui convites já aceitos", async () => {
    const ts = Date.now();
    const owner = await signUpCookie(`mine-own3-${ts}@e.com`);
    const email = `mine-accepted-${ts}@e.com`;
    const { token } = await setupInvite(owner, email);
    const invitee = await signUpCookie(email);
    await app.handle(
      new Request(`http://localhost/api/invites/${token}/accept`, {
        method: "POST",
        headers: { cookie: invitee },
      })
    );

    const res = await app.handle(
      new Request("http://localhost/api/invites/mine", {
        headers: { cookie: invitee },
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).length).toBe(0);
  });

  it("preview traz quem convidou, total, contagem e partes", async () => {
    const ownerCookie = await signUpCookie(uniqueEmail("owner"));
    const inviteeEmail = uniqueEmail("guest");
    const { token } = await setupInvite(ownerCookie, inviteeEmail);

    const inviteeCookie = await signUpCookie(inviteeEmail);
    const res = await app.handle(
      new Request(`http://localhost/api/invites/${token}`, {
        headers: { cookie: inviteeCookie },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.inviterName).toBe("string");
    expect(body.inviterName.length).toBeGreaterThan(0);
    expect(body.installmentsCount).toBeGreaterThan(0);
    expect(body.totalAmountCents).toBeGreaterThan(0);
    expect(Array.isArray(body.parties)).toBe(true);
  });

  it("aceitar notifica o dono", async () => {
    const ownerCookie = await signUpCookie(uniqueEmail("owner"));
    const inviteeEmail = uniqueEmail("guest");
    const { contractId, token } = await setupInvite(ownerCookie, inviteeEmail);
    const inviteeCookie = await signUpCookie(inviteeEmail);
    const acc = await app.handle(
      new Request(`http://localhost/api/invites/${token}/accept`, {
        method: "POST",
        headers: { cookie: inviteeCookie },
      })
    );
    expect(acc.status).toBe(200);
    const notifs = await db
      .select()
      .from(notification)
      .where(eq(notification.contractId, contractId));
    expect(
      notifs.some((n) => n.type === NOTIFICATION_TYPE.inviteAccepted)
    ).toBe(true);
  });

  it("convite expirado retorna 422 ao visualizar (GET)", async () => {
    const ts = Date.now() + 1; // +1 para token único em relação ao teste anterior
    const ownerEmail = `own-exp-view-${ts}@example.com`;
    const inviteeEmail = `invitee-exp-view-${ts}@example.com`;
    const owner = await signUpCookie(ownerEmail);

    const contractId = await createContract(owner);

    const addRes = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner },
        body: JSON.stringify({
          displayName: "Convidado Exp View",
          role: "seller",
        }),
      })
    );
    const { id: participantId } = await addRes.json();

    const expiredToken = `expired-view-${ts}`;
    await db.insert(invite).values({
      contractId,
      participantId,
      email: inviteeEmail.toLowerCase(),
      token: expiredToken,
      expiresAt: new Date(Date.now() - 1000),
    });

    const invitee = await signUpCookie(inviteeEmail);

    const res = await app.handle(
      new Request(`http://localhost/api/invites/${expiredToken}`, {
        headers: { cookie: invitee },
      })
    );
    expect(res.status).toBe(422);
  });
});
