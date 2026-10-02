import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { session, user } from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

describe("revogação da sessão", () => {
  it("o sign-in não entrega cookie session_data (sem cookie cache)", async () => {
    const cookie = await signUpCookie(uniqueEmail("revoke"));
    expect(cookie).toContain("session_token=");
    expect(cookie).not.toContain("session_data=");
  });

  it("apagar a linha da sessão no banco derruba o acesso na hora (401)", async () => {
    const email = uniqueEmail("revoke2");
    const cookie = await signUpCookie(email);

    const me = () =>
      app.handle(
        new Request("http://localhost/api/me", { headers: { cookie } })
      );
    expect((await me()).status).toBe(200);

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
