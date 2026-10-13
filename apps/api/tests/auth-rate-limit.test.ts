import { describe, expect, it } from "bun:test";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Elysia } from "elysia";
import { db, schema } from "../src/db/client";
import { env } from "../src/env";
import { AUTH_RATE_LIMITS, AUTH_RATE_RULES } from "../src/lib/auth-rate-limit";

const isolatedAuth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  advanced: {
    ipAddress: { ipAddressHeaders: ["fly-client-ip"], ipv6Subnet: 64 },
  },
  rateLimit: {
    enabled: true,
    storage: "memory",
    customRules: AUTH_RATE_RULES,
  },
});

const isolatedApp = new Elysia().mount(isolatedAuth.handler);

describe("auth rate limit", () => {
  it("retorna 429 ao exceder o limite de sign-in", async () => {
    const ip = "203.0.113.7";
    const attempts = AUTH_RATE_LIMITS.signIn + 2;
    let sawTooMany = false;
    for (let i = 0; i < attempts; i++) {
      const res = await isolatedApp.handle(
        new Request("http://localhost/api/auth/sign-in/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "fly-client-ip": ip,
          },
          body: JSON.stringify({
            email: "nope@quitto.test",
            password: "wrongpass",
          }),
        })
      );
      if (res.status === 429) {
        sawTooMany = true;
        break;
      }
    }
    expect(sawTooMany).toBe(true);
  });

  it("cada IP em fly-client-ip tem o seu balde", async () => {
    const signIn = (ip: string) =>
      isolatedApp.handle(
        new Request("http://localhost/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json", "fly-client-ip": ip },
          body: JSON.stringify({
            email: "x@quitto.test",
            password: "wrongpass",
          }),
        })
      );
    for (let i = 0; i < AUTH_RATE_LIMITS.signIn + 1; i++) {
      await signIn("203.0.113.20");
    }
    expect((await signIn("203.0.113.20")).status).toBe(429);
    expect((await signIn("203.0.113.21")).status).not.toBe(429);
  });

  it("x-forwarded-for sem fly-client-ip é ignorado (não rouba o balde de um IP real)", async () => {
    const signIn = (headers: Record<string, string>) =>
      isolatedApp.handle(
        new Request("http://localhost/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify({
            email: "y@quitto.test",
            password: "wrongpass",
          }),
        })
      );
    for (let i = 0; i < AUTH_RATE_LIMITS.signIn + 1; i++) {
      await signIn({ "x-forwarded-for": "203.0.113.9, 76.76.21.9" });
    }
    expect((await signIn({ "fly-client-ip": "76.76.21.9" })).status).not.toBe(
      429
    );
  });
});
