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
