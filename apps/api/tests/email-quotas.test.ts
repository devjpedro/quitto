import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";

mock.module("../src/lib/mailer", () => ({
  sendEmail: () => Promise.resolve(),
}));

const { app } = await import("../src/app");
const { env } = await import("../src/env");
const { signUpCookie, uniqueEmail } = await import("./helpers/auth");

const original = env.RATE_LIMIT_ENABLED;
beforeAll(() => {
  env.RATE_LIMIT_ENABLED = "true";
});
afterAll(() => {
  env.RATE_LIMIT_ENABLED = original;
});

const json = (cookie: string) => ({
  "content-type": "application/json",
  cookie,
});

async function newContract(cookie: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: json(cookie),
      body: JSON.stringify({
        title: "Contrato",
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

async function newSlot(cookie: string, contractId: string): Promise<string> {
  const res = await app.handle(
    new Request(`http://localhost/api/contracts/${contractId}/participants`, {
      method: "POST",
      headers: json(cookie),
      body: JSON.stringify({ displayName: "Convidado", role: "seller" }),
    })
  );
  return (await res.json()).id as string;
}

async function freshSlot(cookie: string): Promise<[string, string]> {
  const contractId = await newContract(cookie);
  return [contractId, await newSlot(cookie, contractId)];
}

function invite(cookie: string, contractId: string, slot: string) {
  return app.handle(
    new Request(
      `http://localhost/api/contracts/${contractId}/participants/${slot}/invite`,
      {
        method: "POST",
        headers: json(cookie),
        body: JSON.stringify({ email: uniqueEmail("guest") }),
      }
    )
  );
}

describe("tetos de e-mail de convite", () => {
  it("o 4º convite pendente do mesmo slot dá 409", async () => {
    const cookie = await signUpCookie(uniqueEmail("owner-pend"));
    const contractId = await newContract(cookie);
    const slot = await newSlot(cookie, contractId);
    for (let i = 0; i < 3; i++) {
      expect((await invite(cookie, contractId, slot)).status).toBe(200);
    }
    expect((await invite(cookie, contractId, slot)).status).toBe(409);
  });

  it("o 2º reenvio em menos de 10 min dá 429", async () => {
    const cookie = await signUpCookie(uniqueEmail("owner-resend"));
    const contractId = await newContract(cookie);
    const slot = await newSlot(cookie, contractId);
    await invite(cookie, contractId, slot);
    const resend = () =>
      app.handle(
        new Request(
          `http://localhost/api/contracts/${contractId}/participants/${slot}/invite/resend`,
          { method: "POST", headers: { cookie } }
        )
      );
    expect((await resend()).status).toBe(200);
    expect((await resend()).status).toBe(429);
  });

  it("o 21º convite do usuário no dia dá 429", async () => {
    const cookie = await signUpCookie(uniqueEmail("owner-day"));
    for (let i = 0; i < 20; i++) {
      const [contractId, slot] = await freshSlot(cookie);
      expect((await invite(cookie, contractId, slot)).status).toBe(200);
    }
    const [contractId, slot] = await freshSlot(cookie);
    expect((await invite(cookie, contractId, slot)).status).toBe(429);
  });

  it("criar contrato com contraparte por e-mail conta no mesmo teto diário", async () => {
    const cookie = await signUpCookie(uniqueEmail("owner-create"));
    for (let i = 0; i < 20; i++) {
      const [contractId, slot] = await freshSlot(cookie);
      await invite(cookie, contractId, slot);
    }
    const res = await app.handle(
      new Request("http://localhost/api/contracts", {
        method: "POST",
        headers: json(cookie),
        body: JSON.stringify({
          title: "Com convite",
          ownerRole: "buyer",
          requiresConfirmation: false,
          schedule: {
            mode: "auto",
            totalAmountCents: 3000,
            installmentsCount: 3,
            firstDueDate: "2026-09-10",
          },
          counterparty: { name: "Fulano", email: uniqueEmail("cp") },
        }),
      })
    );
    expect(res.status).toBe(429);
  });
});
