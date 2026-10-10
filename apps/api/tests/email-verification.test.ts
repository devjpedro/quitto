import { beforeEach, describe, expect, it, mock } from "bun:test";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { db, schema } from "../src/db/client";
import { user } from "../src/db/schema";
import { env } from "../src/env";

const sent: { to: string; subject: string; html: string }[] = [];
mock.module("../src/lib/mailer", () => ({
  sendEmail: (input: { to: string; subject: string; html: string }) => {
    sent.push(input);
    return Promise.resolve();
  },
}));
const { app } = await import("../src/app");

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

function signUpOnApp(e: string, headers: Record<string, string>) {
  return app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ name: "V", email: e, password: "password123" }),
    })
  );
}

async function storedLocale(e: string): Promise<string | null> {
  const [row] = await db
    .select({ locale: user.locale })
    .from(user)
    .where(eq(user.email, e));
  return row?.locale ?? null;
}

describe("o idioma do cadastro", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("o cadastro grava o idioma do pedido em user.locale", async () => {
    const withCookie = email();
    await signUpOnApp(withCookie, {
      "accept-language": "pt-BR",
      cookie: "locale=en-US",
    });
    expect(await storedLocale(withCookie)).toBe("en-US");

    const withHeader = email();
    await signUpOnApp(withHeader, { "accept-language": "en-US,en;q=0.9" });
    expect(await storedLocale(withHeader)).toBe("en-US");

    const withNone = email();
    await signUpOnApp(withNone, {});
    expect(await storedLocale(withNone)).toBeNull();
  });

  it("o e-mail de confirmação sai no idioma do cadastro", async () => {
    const e = email();
    await signUpOnApp(e, { cookie: "locale=en-US" });
    const mail = sent.find((s) => s.to === e);
    expect(mail?.subject).toBe("Confirm your email on Quitto");
    expect(mail?.html).toContain('<html lang="en-US">');
  });
});
