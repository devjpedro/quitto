import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

async function signUpCookie(tag: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Test",
        email: `${tag}-${Date.now()}@example.com`,
        password: "password123",
      }),
    })
  );
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("sign-up did not return a set-cookie header");
  }
  const [cookie] = setCookie.split(";");
  if (!cookie) {
    throw new Error("could not parse session cookie");
  }
  return cookie;
}

function createContract(cookie: string) {
  return app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "Apê do irmão",
        ownerRole: "buyer",
        requiresConfirmation: true,
        schedule: {
          mode: "auto",
          totalAmountCents: 12_000_000,
          installmentsCount: 60,
          firstDueDate: "2026-07-10",
        },
      }),
    })
  );
}

describe("POST /api/contracts", () => {
  it("requer autenticação", async () => {
    const res = await createContract("");
    expect(res.status).toBe(401);
  });

  it("cria contrato e retorna id", async () => {
    const cookie = await signUpCookie("create");
    const res = await createContract(cookie);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.id).toBe("string");
  });
});
