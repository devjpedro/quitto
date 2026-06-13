import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

async function signUpCookie(email: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Test", email, password: "password123" }),
    })
  );
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("sign-up did not return a set-cookie header");
  }
  const [cookie] = setCookie.split(";");
  if (!cookie) {
    throw new Error("could not parse session cookie");
  }
  return cookie;
}

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
});
