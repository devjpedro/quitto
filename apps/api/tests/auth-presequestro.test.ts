import { describe, expect, it, mock } from "bun:test";
import { eq } from "drizzle-orm";

const TOKEN_IN_LINK = /token=([\w.-]+)/;
const sent: { to: string; html: string }[] = [];
mock.module("../src/lib/mailer", () => ({
  sendEmail: (input: { to: string; html: string }) => {
    sent.push(input);
    return Promise.resolve();
  },
}));
const { app } = await import("../src/app");

import { db } from "../src/db/client";
import { contract, participant, user } from "../src/db/schema";
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

  it("o link de verificação do cadastro apagado não verifica a conta recriada", async () => {
    const e = uniqueEmail("presq-link");
    await signUp(e, "senha-do-atacante1");
    const link = sent.findLast((m) => m.to === e)?.html.match(TOKEN_IN_LINK);
    expect(link?.[1]).toBeTruthy();
    // The token's iat has second resolution: let the second turn over.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await signUp(e, "senha-do-dono-123");
    const res = await app.handle(
      new Request(`http://localhost/api/auth/verify-email?token=${link?.[1]}`)
    );
    expect(res.status).toBe(400);
    expect(res.headers.getSetCookie().join(";")).not.toContain("session_token");
    const [row] = await db.select().from(user).where(eq(user.email, e));
    expect(row?.emailVerified).toBe(false);
  });

  it("o link do cadastro vigente continua verificando a conta", async () => {
    const e = uniqueEmail("presq-link-ok");
    await signUp(e, "senha-do-dono-123");
    const token = sent
      .findLast((m) => m.to === e)
      ?.html.match(TOKEN_IN_LINK)?.[1];
    const res = await app.handle(
      new Request(`http://localhost/api/auth/verify-email?token=${token}`)
    );
    expect(res.status).toBeLessThan(400);
    const [row] = await db.select().from(user).where(eq(user.email, e));
    expect(row?.emailVerified).toBe(true);
  });

  it("conta não verificada dona de contrato não é apagada por um novo cadastro", async () => {
    const e = uniqueEmail("presq-dono");
    await signUp(e, "senha-original-123");
    const [row] = await db.select().from(user).where(eq(user.email, e));
    await db.insert(contract).values({
      ownerId: row?.id ?? "",
      title: "T",
      ownerRole: "buyer",
      totalAmountCents: 1000,
      installmentsCount: 1,
    });
    await signUp(e, "senha-do-intruso-1");
    const [after] = await db.select().from(user).where(eq(user.email, e));
    expect(after?.id).toBe(row?.id);
  });

  it("conta não verificada vinculada a um participante não é apagada", async () => {
    const donoEmail = uniqueEmail("presq-dono2");
    await signUpCookie(donoEmail);
    const [dono] = await db
      .select()
      .from(user)
      .where(eq(user.email, donoEmail));
    const e = uniqueEmail("presq-vinc");
    await signUp(e, "senha-original-123");
    const [row] = await db.select().from(user).where(eq(user.email, e));
    const [anyContract] = await db
      .insert(contract)
      .values({
        ownerId: dono?.id ?? "",
        title: "T",
        ownerRole: "seller",
        totalAmountCents: 1000,
        installmentsCount: 1,
      })
      .returning();
    await db.insert(participant).values({
      contractId: anyContract?.id ?? "",
      displayName: "X",
      role: "buyer",
      linkedUserId: row?.id,
    });
    await signUp(e, "senha-do-intruso-1");
    const [after] = await db.select().from(user).where(eq(user.email, e));
    expect(after?.id).toBe(row?.id);
  });
});
