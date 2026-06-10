import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

const unique = `t${Date.now()}@example.com`;

async function signUpAndGetCookie(): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Test",
        email: unique,
        password: "password123",
      }),
    })
  );
  if (res.status !== 200) {
    throw new Error(`sign-up failed: status ${res.status}`);
  }
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("sign-up did not return a set-cookie header");
  }
  return setCookie.split(";")[0] as string;
}

describe("GET /api/me", () => {
  it("retorna 401 sem sessão", async () => {
    const res = await app.handle(new Request("http://localhost/api/me"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("retorna o usuário com sessão válida", async () => {
    const cookie = await signUpAndGetCookie();
    const res = await app.handle(
      new Request("http://localhost/api/me", { headers: { cookie } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe(unique);
  });
});
