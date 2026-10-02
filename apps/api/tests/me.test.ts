import { describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

const unique = `t${Date.now()}@example.com`;

describe("GET /api/me", () => {
  it("retorna 401 sem sessão", async () => {
    const res = await app.handle(new Request("http://localhost/api/me"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("retorna o usuário com sessão válida", async () => {
    const cookie = await signUpCookie(unique);
    const res = await app.handle(
      new Request("http://localhost/api/me", { headers: { cookie } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe(unique);
  });
});

describe("opt-in de lembrete por e-mail", () => {
  const get = (cookie: string) =>
    app.handle(new Request("http://localhost/api/me", { headers: { cookie } }));
  const patch = (cookie: string, body: unknown) =>
    app.handle(
      new Request("http://localhost/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(body),
      })
    );

  it("GET expõe opt-in (false) e disponibilidade (false sem a chave global)", async () => {
    const cookie = await signUpCookie(uniqueEmail("me-rem"));
    const me = await (await get(cookie)).json();
    expect(me.emailRemindersOptIn).toBe(false);
    expect(me.emailRemindersAvailable).toBe(false);
  });

  it("PATCH só com emailRemindersOptIn não mexe na chave PIX (e vice-versa)", async () => {
    const cookie = await signUpCookie(uniqueEmail("me-rem2"));
    await patch(cookie, { pixKey: "joao@example.com" });
    const r1 = await patch(cookie, { emailRemindersOptIn: true });
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({
      pixKey: "joao@example.com",
      emailRemindersOptIn: true,
      locale: "pt-BR",
    });

    const r2 = await patch(cookie, { pixKey: null });
    expect(await r2.json()).toEqual({
      pixKey: null,
      emailRemindersOptIn: true,
      locale: "pt-BR",
    });
    expect((await (await get(cookie)).json()).emailRemindersOptIn).toBe(true);
  });
});

describe("idioma da conta", () => {
  const get = (cookie: string) =>
    app.handle(new Request("http://localhost/api/me", { headers: { cookie } }));
  const patch = (cookie: string, body: unknown) =>
    app.handle(
      new Request("http://localhost/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(body),
      })
    );

  it("default é pt-BR", async () => {
    const cookie = await signUpCookie(uniqueEmail("me-loc"));
    expect((await (await get(cookie)).json()).locale).toBe("pt-BR");
  });

  it("PATCH grava en-US sem mexer no resto", async () => {
    const cookie = await signUpCookie(uniqueEmail("me-loc2"));
    await patch(cookie, { pixKey: "joao@example.com" });
    const res = await patch(cookie, { locale: "en-US" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      pixKey: "joao@example.com",
      emailRemindersOptIn: false,
      locale: "en-US",
    });
    expect((await (await get(cookie)).json()).locale).toBe("en-US");
  });

  it("rejeita idioma fora da lista", async () => {
    const cookie = await signUpCookie(uniqueEmail("me-loc3"));
    expect((await patch(cookie, { locale: "fr" })).status).toBe(422);
  });
});
