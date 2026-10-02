import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { session, user } from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

describe("cookie cache da sessão", () => {
  it("o sign-in entrega o cookie session_data junto com o session_token", async () => {
    const cookie = await signUpCookie(uniqueEmail("cache"));
    expect(cookie).toContain("session_token=");
    expect(cookie).toContain("session_data=");
  });

  it("a API enxerga a revogação da sessão na hora, mesmo com o cookie session_data válido", async () => {
    const email = uniqueEmail("cache2");
    const cookie = await signUpCookie(email);
    expect(cookie).toContain("session_data=");

    const me = () =>
      app.handle(
        new Request("http://localhost/api/me", { headers: { cookie } })
      );
    expect((await me()).status).toBe(200);

    // Revoke server-side: the signed session_data cookie is still within its 5 min maxAge.
    const [row] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    if (!row) {
      throw new Error("user not found");
    }
    await db.delete(session).where(eq(session.userId, row.id));

    expect((await me()).status).toBe(401);
  });
});
