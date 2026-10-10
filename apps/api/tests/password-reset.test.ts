import { beforeEach, describe, expect, it, mock } from "bun:test";

const sent: { to: string; subject: string; html: string }[] = [];
mock.module("../src/lib/mailer", () => ({
  sendEmail: (input: { to: string; subject: string; html: string }) => {
    sent.push(input);
    return Promise.resolve();
  },
}));

const { app } = await import("../src/app");
const { db } = await import("../src/db/client");
const { user } = await import("../src/db/schema");
const { eq } = await import("drizzle-orm");

function email(): string {
  return `reset-${Math.floor(performance.now() * 1000)}@quitto.test`;
}

describe("password reset", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("request-password-reset envia e-mail com link de reset", async () => {
    const e = email();
    await app.handle(
      new Request("http://localhost/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "R", email: e, password: "password123" }),
      })
    );
    sent.length = 0; // descarta e-mail de verificação enviado no sign-up

    const res = await app.handle(
      new Request("http://localhost/api/auth/request-password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: e,
          redirectTo: "http://localhost:3001/reset-password",
        }),
      })
    );
    expect(res.status).toBe(200);
    expect(sent.length).toBe(1);
    expect(sent[0]?.to).toBe(e);
    expect(sent[0]?.html).toContain("reset-password");
  });

  async function requestReset(e: string, headers: Record<string, string>) {
    await app.handle(
      new Request("http://localhost/api/auth/request-password-reset", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({
          email: e,
          redirectTo: "http://localhost:3001/reset-password",
        }),
      })
    );
  }

  async function newAccount(): Promise<string> {
    const e = email();
    await app.handle(
      new Request("http://localhost/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "R", email: e, password: "password123" }),
      })
    );
    sent.length = 0;
    return e;
  }

  it("o e-mail de nova senha sai no idioma do pedido quando a conta não escolheu", async () => {
    const e = await newAccount();
    await requestReset(e, { "accept-language": "en-US" });
    expect(sent[0]?.subject).toBe("Create a new Quitto password");
    expect(sent[0]?.html).toContain('<html lang="en-US">');
  });

  it("a conta com idioma escolhido manda no idioma dela", async () => {
    const e = await newAccount();
    await db.update(user).set({ locale: "pt-BR" }).where(eq(user.email, e));
    await requestReset(e, { cookie: "locale=en-US" });
    expect(sent[0]?.subject).toBe("Crie uma nova senha no Quitto");
  });
});
