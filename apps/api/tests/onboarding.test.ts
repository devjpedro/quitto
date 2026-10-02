import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { user } from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

const dismiss = (cookie?: string) =>
  app.handle(
    new Request("http://localhost/api/me/onboarding/dismiss", {
      method: "POST",
      headers: cookie ? { cookie } : {},
    })
  );

describe("POST /api/me/onboarding/dismiss", () => {
  it("exige sessão", async () => {
    expect((await dismiss()).status).toBe(401);
  });

  it("grava a hora da dispensa e devolve", async () => {
    const email = uniqueEmail("onb-dismiss");
    const cookie = await signUpCookie(email);
    const before = Date.now();
    const res = await dismiss(cookie);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { dismissedAt: string };
    expect(Date.parse(body.dismissedAt)).toBeGreaterThanOrEqual(before - 1000);
    const [row] = await db
      .select({ at: user.onboardingDismissedAt })
      .from(user)
      .where(eq(user.email, email));
    expect(row?.at?.toISOString()).toBe(body.dismissedAt);
  });

  it("é idempotente: a segunda chamada mantém a primeira hora", async () => {
    const cookie = await signUpCookie(uniqueEmail("onb-twice"));
    const first = (await (await dismiss(cookie)).json()) as {
      dismissedAt: string;
    };
    const second = (await (await dismiss(cookie)).json()) as {
      dismissedAt: string;
    };
    expect(second.dismissedAt).toBe(first.dismissedAt);
  });
});
