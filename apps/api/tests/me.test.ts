import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { account, user } from "../src/db/schema";
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

describe("GET /api/me: hasPassword, createdAt e o que a exclusão leva", () => {
  const get = (cookie: string, path = "/api/me") =>
    app.handle(new Request(`http://localhost${path}`, { headers: { cookie } }));

  it("hasPassword: true com senha; false com conta só do Google", async () => {
    const withPassword = await signUpCookie(uniqueEmail("me-pw"));
    expect((await (await get(withPassword)).json()).hasPassword).toBe(true);

    const googleEmail = uniqueEmail("me-google");
    const cookie = await signUpCookie(googleEmail);
    const [row] = await db
      .select()
      .from(user)
      .where(eq(user.email, googleEmail));
    await db.delete(account).where(eq(account.userId, row?.id as string));
    await db.insert(account).values({
      id: `google-${row?.id}`,
      accountId: `g-${row?.id}`,
      providerId: "google",
      userId: row?.id as string,
    });
    expect((await (await get(cookie)).json()).hasPassword).toBe(false);
  });

  it("createdAt: o dia em que a conta nasceu, em ISO", async () => {
    const cookie = await signUpCookie(uniqueEmail("me-since"));
    const me = await (await get(cookie)).json();
    expect(new Date(me.createdAt).getTime()).toBeGreaterThan(
      Date.now() - 60_000
    );
  });

  it("deletion-summary: só os contratos que a pessoa criou, as parcelas e as pessoas", async () => {
    const owner = await signUpCookie(uniqueEmail("me-del"));
    const other = await signUpCookie(uniqueEmail("me-del-other"));
    const create = (cookie: string, title: string, counterparty?: string) =>
      app.handle(
        new Request("http://localhost/api/contracts", {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({
            title,
            ownerRole: "buyer",
            requiresConfirmation: false,
            ...(counterparty ? { counterparty: { name: counterparty } } : {}),
            schedule: {
              mode: "auto",
              totalAmountCents: 3000,
              installmentsCount: 3,
              firstDueDate: "2026-07-10",
            },
          }),
        })
      );
    await create(owner, "Moto", "Rafael Prado");
    await create(owner, "Mesa", "rafael  prado");
    await create(owner, "Cama", "Ana Lima");
    await create(other, "De outro", "Zé Outro");
    const summary = await (await get(owner, "/api/me/deletion-summary")).json();
    expect(summary.contracts).toBe(3);
    expect(summary.installments).toBe(9);
    expect(summary.people).toEqual([
      { name: "Ana Lima" },
      { name: "Rafael Prado" },
    ]);
    const none = await (
      await get(
        await signUpCookie(uniqueEmail("me-del-none")),
        "/api/me/deletion-summary"
      )
    ).json();
    expect(none).toEqual({ contracts: 0, installments: 0, people: [] });
    expect(
      (
        await app.handle(
          new Request("http://localhost/api/me/deletion-summary")
        )
      ).status
    ).toBe(401);
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
      locale: null,
      tourCompletedAt: null,
    });

    const r2 = await patch(cookie, { pixKey: null });
    expect(await r2.json()).toEqual({
      pixKey: null,
      emailRemindersOptIn: true,
      locale: null,
      tourCompletedAt: null,
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

  it("default é null (não escolhido)", async () => {
    const cookie = await signUpCookie(uniqueEmail("me-loc"));
    expect((await (await get(cookie)).json()).locale).toBeNull();
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
      tourCompletedAt: null,
    });
    expect((await (await get(cookie)).json()).locale).toBe("en-US");
  });

  it("rejeita idioma fora da lista", async () => {
    const cookie = await signUpCookie(uniqueEmail("me-loc3"));
    expect((await patch(cookie, { locale: "fr" })).status).toBe(422);
  });
});

describe("tour guiado", () => {
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

  it("conta nova: ainda não viu o tour (null)", async () => {
    const cookie = await signUpCookie(uniqueEmail("me-tour"));
    expect((await (await get(cookie)).json()).tourCompletedAt).toBeNull();
  });

  it("concluir grava a hora e o GET devolve; refazer zera", async () => {
    const cookie = await signUpCookie(uniqueEmail("me-tour2"));
    const before = Date.now();
    const done = await (await patch(cookie, { tourCompleted: true })).json();
    expect(Date.parse(done.tourCompletedAt)).toBeGreaterThanOrEqual(
      before - 1000
    );
    expect((await (await get(cookie)).json()).tourCompletedAt).toBe(
      done.tourCompletedAt
    );
    const again = await (await patch(cookie, { tourCompleted: false })).json();
    expect(again.tourCompletedAt).toBeNull();
    expect((await (await get(cookie)).json()).tourCompletedAt).toBeNull();
  });

  it("não mexe nos outros campos", async () => {
    const cookie = await signUpCookie(uniqueEmail("me-tour3"));
    await patch(cookie, { locale: "en-US" });
    const res = await (await patch(cookie, { tourCompleted: true })).json();
    expect(res.locale).toBe("en-US");
  });
});
