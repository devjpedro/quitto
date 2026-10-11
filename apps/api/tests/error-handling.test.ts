import { beforeEach, describe, expect, it, mock } from "bun:test";

const real = await import("@sentry/bun");
const captured: unknown[] = [];
mock.module("@sentry/bun", () => ({
  ...real,
  captureException: (e: unknown) => captured.push(e),
}));

const { buildApp } = await import("../src/app");
const { signUpCookie, uniqueEmail } = await import("./helpers/auth");
const { t } = await import("elysia");

const testApp = buildApp()
  .get("/boom", () => {
    throw new Error(
      "Failed query: select * from user where email = $1 params: x@y"
    );
  })
  .post("/echo", ({ body }) => body, { body: t.Object({ n: t.Number() }) });

describe("onError", () => {
  beforeEach(() => {
    captured.length = 0;
  });

  it("erro inesperado vira 500 genérico, sem SQL nem params, e vai para o Sentry", async () => {
    const res = await testApp.handle(new Request("http://localhost/boom"));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("Failed query");
    expect(text).not.toContain("params");
    expect(JSON.parse(text).error).toMatchObject({
      code: "INTERNAL",
      message: "Erro interno",
    });
    expect(captured).toHaveLength(1);
  });

  it("404 de rota inexistente e body inválido não vão para o Sentry e mantêm o status", async () => {
    const notFound = await testApp.handle(
      new Request("http://localhost/api/nao-existe")
    );
    expect(notFound.status).toBe(404);
    const invalid = await testApp.handle(
      new Request("http://localhost/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ n: "x" }),
      })
    );
    expect(invalid.status).toBe(422);
    const broken = await testApp.handle(
      new Request("http://localhost/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{nope",
      })
    );
    expect(broken.status).toBeLessThan(500);
    expect(captured).toHaveLength(0);
  });

  it("o id malformado continua 404 para quem tem sessão", async () => {
    const cookie = await signUpCookie(uniqueEmail("onerr"));
    const res = await testApp.handle(
      new Request("http://localhost/api/contracts/abc", { headers: { cookie } })
    );
    expect(res.status).toBe(404);
    expect(captured).toHaveLength(0);
  });
});
