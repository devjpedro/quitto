import { describe, expect, it } from "bun:test";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { db, schema } from "../src/db/client";
import { user } from "../src/db/schema";
import { env } from "../src/env";

const isolatedAuth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  emailVerification: {
    sendVerificationEmail: async () => {
      // no-op: avoids real email dispatch during tests
    },
  },
});

const isolatedApp = new Elysia().mount(isolatedAuth.handler);

function email(): string {
  return `verify-${Math.floor(performance.now() * 1000)}@quitto.test`;
}

function signUp(e: string) {
  return isolatedApp.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "V", email: e, password: "password123" }),
    })
  );
}

function signIn(e: string) {
  return isolatedApp.handle(
    new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: e, password: "password123" }),
    })
  );
}

describe("email verification obrigatória", () => {
  it("bloqueia sign-in de usuário não verificado", async () => {
    const e = email();
    await signUp(e);
    const res = await signIn(e);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("permite sign-in após verificar", async () => {
    const e = email();
    await signUp(e);
    await db.update(user).set({ emailVerified: true }).where(eq(user.email, e));
    const res = await signIn(e);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeTruthy();
  });
});
