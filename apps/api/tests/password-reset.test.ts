import { beforeEach, describe, expect, it, mock } from "bun:test";

const sent: { to: string; subject: string; html: string }[] = [];
mock.module("../src/lib/mailer", () => ({
  sendEmail: (input: { to: string; subject: string; html: string }) => {
    sent.push(input);
    return Promise.resolve();
  },
}));

const { app } = await import("../src/app");

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
});
