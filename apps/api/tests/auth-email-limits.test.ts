import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { env } from "../src/env";

const original = env.RATE_LIMIT_ENABLED;
beforeAll(() => {
  env.RATE_LIMIT_ENABLED = "true";
});
afterAll(() => {
  env.RATE_LIMIT_ENABLED = original;
});

let seq = 0;
function post(path: string, email: string, ip: string) {
  return app.handle(
    new Request(`http://localhost/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "fly-client-ip": ip },
      body: JSON.stringify({
        email,
        password: "wrong-password",
        redirectTo: "http://localhost:3001/reset-password",
      }),
    })
  );
}

function target(tag: string): string {
  seq += 1;
  return `${tag}-${Date.now()}-${seq}@quitto.test`;
}

describe("limite por e-mail no auth", () => {
  it("o 6º sign-in do mesmo e-mail dá 429 mesmo variando o IP; outro e-mail passa", async () => {
    const victim = target("lim-signin");
    for (let i = 1; i <= 5; i++) {
      const res = await post("/sign-in/email", victim, `198.51.100.${i}`);
      expect(res.status).not.toBe(429);
    }
    const sixth = await post(
      "/sign-in/email",
      victim.toUpperCase(),
      "198.51.100.99"
    );
    expect(sixth.status).toBe(429);
    const other = await post(
      "/sign-in/email",
      target("lim-other"),
      "198.51.100.50"
    );
    expect(other.status).not.toBe(429);
  });

  it("o 4º pedido de reset e o 4º reenvio de verificação do mesmo e-mail dão 429", async () => {
    for (const path of [
      "/request-password-reset",
      "/send-verification-email",
    ]) {
      const victim = target("lim-mail");
      for (let i = 1; i <= 3; i++) {
        const res = await post(path, victim, `192.0.2.${i}`);
        expect(res.status).not.toBe(429);
      }
      expect((await post(path, victim, "192.0.2.99")).status).toBe(429);
    }
  });

  it("e-mail com mais de 254 caracteres dá 400 e não consome o balde", async () => {
    const long = `${"a".repeat(300)}@quitto.test`;
    for (let i = 1; i <= 6; i++) {
      const res = await post("/sign-in/email", long, `203.0.113.${i}`);
      expect(res.status).toBe(400);
    }
  });
});
