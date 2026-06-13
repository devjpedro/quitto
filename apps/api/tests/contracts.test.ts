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

  it("rejeita ownerRole neutral na criação (422)", async () => {
    const cookie = await signUpCookie("neutral");
    const res = await app.handle(
      new Request("http://localhost/api/contracts", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          title: "Apê do irmão",
          ownerRole: "neutral",
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
    expect(res.status).toBe(422);
  });
});

describe("GET /api/contracts", () => {
  it("lista apenas os contratos do usuário com progresso", async () => {
    const cookie = await signUpCookie("list");
    await createContract(cookie);
    const res = await app.handle(
      new Request("http://localhost/api/contracts", { headers: { cookie } })
    );
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]).toHaveProperty("percent");
    expect(list[0].totalCents).toBe(12_000_000);
  });
});

describe("GET /api/contracts/:id", () => {
  it("retorna o detalhe para o dono", async () => {
    const cookie = await signUpCookie("detail");
    const created = await (await createContract(cookie)).json();
    const res = await app.handle(
      new Request(`http://localhost/api/contracts/${created.id}`, {
        headers: { cookie },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("buyer"); // createContract usa ownerRole: "buyer"
    expect(body.isOwner).toBe(true);
    expect(body.installments).toHaveLength(60);
  });

  it("dono aparece com seu papel (não 'owner') e isOwner=true", async () => {
    const cookie = await signUpCookie("detail-owner");
    const created = await (await createContract(cookie)).json();
    const res = await app.handle(
      new Request(`http://localhost/api/contracts/${created.id}`, {
        headers: { cookie },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const me = body.participants.find((p: { isOwner: boolean }) => p.isOwner);
    expect(me).toBeTruthy();
    expect(me.role).not.toBe("owner");
    expect(me.role).toBe("buyer"); // createContract usa ownerRole: "buyer"
  });

  it("retorna 404 para quem não tem acesso", async () => {
    const ownerCookie = await signUpCookie("own");
    const created = await (await createContract(ownerCookie)).json();
    const strangerCookie = await signUpCookie("stranger");
    const res = await app.handle(
      new Request(`http://localhost/api/contracts/${created.id}`, {
        headers: { cookie: strangerCookie },
      })
    );
    expect(res.status).toBe(404);
  });
});

describe("PATCH installment", () => {
  it("o dono edita o valor de uma parcela", async () => {
    const cookie = await signUpCookie("patch");
    const created = await (await createContract(cookie)).json();
    const detail = await (
      await app.handle(
        new Request(`http://localhost/api/contracts/${created.id}`, {
          headers: { cookie },
        })
      )
    ).json();
    const first = detail.installments[0];
    const res = await app.handle(
      new Request(
        `http://localhost/api/contracts/${created.id}/installments/${first.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({ amountCents: 99_999 }),
        }
      )
    );
    expect(res.status).toBe(200);
  });
});
