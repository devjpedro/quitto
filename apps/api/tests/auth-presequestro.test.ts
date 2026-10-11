import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { user } from "../src/db/schema";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

function post(path: string, body: Record<string, unknown>, cookie?: string) {
  return app.handle(
    new Request(`http://localhost/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    })
  );
}

const signUp = (email: string, password: string, name = "Test") =>
  post("/sign-up/email", { name, email, password });
const signIn = (email: string, password: string) =>
  post("/sign-in/email", { email, password });

describe("pré-sequestro de conta", () => {
  it("um novo cadastro apaga o anterior não verificado: só a senha do dono vale", async () => {
    const e = uniqueEmail("presq");
    await signUp(e, "senha-do-atacante1");
    await signUp(e, "senha-do-dono-123");
    await db.update(user).set({ emailVerified: true }).where(eq(user.email, e));
    expect((await signIn(e, "senha-do-atacante1")).status).toBe(401);
    expect((await signIn(e, "senha-do-dono-123")).status).toBe(200);
  });

  it("conta já verificada não é apagada por um novo cadastro", async () => {
    const e = uniqueEmail("presq-ok");
    const cookie = await signUpCookie(e);
    await signUp(e, "outra-senha-123");
    const me = await app.handle(
      new Request("http://localhost/api/me", { headers: { cookie } })
    );
    expect(me.status).toBe(200);
    expect((await signIn(e, "password123")).status).toBe(200);
  });

  it("name com mais de 120 caracteres é recusado no cadastro e no update-user", async () => {
    const long = "a".repeat(121);
    const res = await signUp(uniqueEmail("longname"), "password123", long);
    expect(res.status).toBe(400);
    const cookie = await signUpCookie(uniqueEmail("longname2"));
    const upd = await post("/update-user", { name: long }, cookie);
    expect(upd.status).toBe(400);
    const ok = await post("/update-user", { name: "Nome ok" }, cookie);
    expect(ok.status).toBe(200);
  });
});
