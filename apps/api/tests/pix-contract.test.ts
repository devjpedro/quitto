import { describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

async function createContract(cookie: string) {
  const res = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "Aluguel",
        ownerRole: "seller",
        requiresConfirmation: false,
        schedule: {
          mode: "auto",
          totalAmountCents: 300_000,
          installmentsCount: 3,
          firstDueDate: "2026-08-10",
        },
      }),
    })
  );
  return (await res.json()).id as string;
}

function patchPix(cookie: string, id: string, pixKey: string | null) {
  return app.handle(
    new Request(`http://localhost/api/contracts/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ pixKey }),
    })
  );
}

describe("PATCH /api/contracts/:id (override PIX)", () => {
  it("dono salva override; GET devolve", async () => {
    const cookie = await signUpCookie(uniqueEmail("cpix"));
    const id = await createContract(cookie);
    const res = await patchPix(cookie, id, "joao@example.com");
    expect(res.status).toBe(200);
    expect((await res.json()).pixKey).toBe("joao@example.com");

    const get = await app.handle(
      new Request(`http://localhost/api/contracts/${id}`, {
        headers: { cookie },
      })
    );
    expect((await get.json()).contract.pixKey).toBe("joao@example.com");
  });

  it("rejeita chave inválida (422)", async () => {
    const cookie = await signUpCookie(uniqueEmail("cpixbad"));
    const id = await createContract(cookie);
    expect((await patchPix(cookie, id, "xxx")).status).toBe(422);
  });

  it("não-dono recebe 403/404", async () => {
    const owner = await signUpCookie(uniqueEmail("cpixowner"));
    const id = await createContract(owner);
    const other = await signUpCookie(uniqueEmail("cpixother"));
    const res = await patchPix(other, id, "joao@example.com");
    expect([403, 404]).toContain(res.status);
  });
});
