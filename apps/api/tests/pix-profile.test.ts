import { describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

function patchPix(cookie: string, pixKey: string | null) {
  return app.handle(
    new Request("http://localhost/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ pixKey }),
    })
  );
}

describe("PATCH /api/me (chave PIX)", () => {
  it("salva e normaliza a chave; GET /me devolve", async () => {
    const cookie = await signUpCookie(uniqueEmail("pix"));
    const res = await patchPix(cookie, "529.982.247-25");
    expect(res.status).toBe(200);
    expect((await res.json()).pixKey).toBe("52998224725");

    const me = await app.handle(
      new Request("http://localhost/api/me", { headers: { cookie } })
    );
    expect((await me.json()).pixKey).toBe("52998224725");
  });

  it("rejeita chave inválida (422)", async () => {
    const cookie = await signUpCookie(uniqueEmail("pixbad"));
    const res = await patchPix(cookie, "não-é-chave");
    expect(res.status).toBe(422);
  });

  it("limpa a chave com null", async () => {
    const cookie = await signUpCookie(uniqueEmail("pixclear"));
    await patchPix(cookie, "joao@example.com");
    const res = await patchPix(cookie, null);
    expect(res.status).toBe(200);
    expect((await res.json()).pixKey).toBeNull();
  });

  it("exige autenticação", async () => {
    const res = await patchPix("", "joao@example.com");
    expect(res.status).toBe(401);
  });
});
