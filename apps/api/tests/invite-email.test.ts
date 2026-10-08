import { beforeEach, describe, expect, it } from "bun:test";

const sent: { to: string; subject: string; html: string }[] = [];

import { mock } from "bun:test";

mock.module("../src/lib/mailer", () => ({
  sendEmail: (i: { to: string; subject: string; html: string }) => {
    sent.push(i);
    return Promise.resolve();
  },
}));

const { app } = await import("../src/app");
const { signUpCookie, uniqueEmail } = await import("./helpers/auth");
const { db } = await import("../src/db/client");
const { invite } = await import("../src/db/schema");
const { eq } = await import("drizzle-orm");

async function createContract(cookie: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "Contrato Convite",
        ownerRole: "buyer",
        requiresConfirmation: false,
        schedule: {
          mode: "auto",
          totalAmountCents: 3000,
          installmentsCount: 3,
          firstDueDate: "2026-09-10",
        },
      }),
    })
  );
  return (await res.json()).id as string;
}

describe("invite email", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("reenviar mantém o token (o mesmo link) e estende o prazo", async () => {
    const cookie = await signUpCookie(uniqueEmail("owner"));
    const contractId = await createContract(cookie);
    const add = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ displayName: "Convidado", role: "seller" }),
      })
    );
    const { id: participantId } = await add.json();
    const guestEmail = uniqueEmail("guest");
    const first = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/${participantId}/invite`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({ email: guestEmail }),
        }
      )
    );
    const firstToken = (await first.json()).token as string;
    // About to expire: the resend has to push it a week ahead again.
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    await db
      .update(invite)
      .set({ expiresAt: soon })
      .where(eq(invite.token, firstToken));
    sent.length = 0;
    const res = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/${participantId}/invite/resend`,
        { method: "POST", headers: { cookie } }
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe(firstToken);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(
      soon.getTime() + 6 * 24 * 60 * 60 * 1000
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(guestEmail);
    expect(sent[0]?.html).toContain(`/invites/${firstToken}`);
  });

  it("reenviar com a vaga de outro contrato: 404, e o convite dele fica como estava", async () => {
    const ownerA = await signUpCookie(uniqueEmail("owner-a"));
    const contractA = await createContract(ownerA);
    const ownerB = await signUpCookie(uniqueEmail("owner-b"));
    const contractB = await createContract(ownerB);
    const add = await app.handle(
      new Request(`http://localhost/api/contracts/${contractB}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerB },
        body: JSON.stringify({ displayName: "Convidado de B", role: "seller" }),
      })
    );
    const { id: slotOfB } = await add.json();
    const invited = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractB}/participants/${slotOfB}/invite`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: ownerB },
          body: JSON.stringify({ email: uniqueEmail("guest-b") }),
        }
      )
    );
    const { token: tokenOfB, expiresAt: expiresOfB } = await invited.json();
    sent.length = 0;
    // A owns contract A, not B: the slot of B under A's URL is not A's.
    const res = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractA}/participants/${slotOfB}/invite/resend`,
        { method: "POST", headers: { cookie: ownerA } }
      )
    );
    expect(res.status).toBe(404);
    const [row] = await db
      .select()
      .from(invite)
      .where(eq(invite.token, tokenOfB));
    expect(row?.expiresAt.toISOString()).toBe(expiresOfB);
    expect(sent).toHaveLength(0);
  });

  it("reenviar para uma vaga já ocupada: 409, sem e-mail e sem mexer no prazo", async () => {
    const owner = await signUpCookie(uniqueEmail("owner-409"));
    const contractId = await createContract(owner);
    const add = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner },
        body: JSON.stringify({ displayName: "Convidado", role: "seller" }),
      })
    );
    const { id: participantId } = await add.json();
    const guestEmail = uniqueEmail("guest-409");
    const invited = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/${participantId}/invite`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: owner },
          body: JSON.stringify({ email: guestEmail }),
        }
      )
    );
    const { token } = await invited.json();
    const guest = await signUpCookie(guestEmail);
    const accepted = await app.handle(
      new Request(`http://localhost/api/invites/${token}/accept`, {
        method: "POST",
        headers: { cookie: guest },
      })
    );
    expect(accepted.status).toBe(200);
    // A superseded copy: pending, for the slot the first copy already filled.
    const [first] = await db
      .select()
      .from(invite)
      .where(eq(invite.token, token));
    const { id: _id, ...rest } = first as NonNullable<typeof first>;
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    const copyToken = `copy-${token.slice(0, 20)}`;
    await db.insert(invite).values({
      ...rest,
      token: copyToken,
      acceptedAt: null,
      declinedAt: null,
      expiresAt: soon,
    });
    sent.length = 0;
    const res = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/${participantId}/invite/resend`,
        { method: "POST", headers: { cookie: owner } }
      )
    );
    expect(res.status).toBe(409);
    const [copy] = await db
      .select()
      .from(invite)
      .where(eq(invite.token, copyToken));
    expect(copy?.expiresAt.toISOString()).toBe(soon.toISOString());
    expect(sent).toHaveLength(0);
  });

  it("envia e-mail com o link de aceite ao convidar", async () => {
    const cookie = await signUpCookie(uniqueEmail("owner"));
    const contractId = await createContract(cookie);
    const add = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ displayName: "Convidado", role: "seller" }),
      })
    );
    const { id: participantId } = await add.json();
    const guestEmail = uniqueEmail("guest");
    sent.length = 0; // clear sign-up verification emails captured above
    const res = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/${participantId}/invite`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({ email: guestEmail }),
        }
      )
    );
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(guestEmail);
    expect(sent[0]?.html).toContain("/invites/");
  });
});
