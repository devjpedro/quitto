import { describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { signUpCookie } from "./helpers/auth";

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
