import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

async function signUp(email: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Test", email, password: "password123" }),
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

let seq = 0;
function uniqueEmail(tag: string): string {
  seq += 1;
  return `${tag}-${Date.now()}-${seq}@example.com`;
}

async function createContract(cookie: string): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title: "Contrato Teste",
        ownerRole: "buyer",
        requiresConfirmation: true,
        schedule: {
          mode: "auto",
          totalAmountCents: 3000,
          installmentsCount: 3,
          firstDueDate: "2026-07-10",
        },
      }),
    })
  );
  const body = await res.json();
  return body.id as string;
}

/** Adds a seller slot, invites `email`, signs that user up and accepts → returns the linked member's cookie. */
async function joinAsMember(
  ownerCookie: string,
  contractId: string
): Promise<string> {
  const email = uniqueEmail("member");
  const addRes = await app.handle(
    new Request(`http://localhost/api/contracts/${contractId}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({ displayName: "Membro", role: "seller" }),
    })
  );
  const { id: participantId } = await addRes.json();
  const invRes = await app.handle(
    new Request(
      `http://localhost/api/contracts/${contractId}/participants/${participantId}/invite`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({ email }),
      }
    )
  );
  const { token } = await invRes.json();
  const memberCookie = await signUp(email);
  const acc = await app.handle(
    new Request(`http://localhost/api/invites/${token}/accept`, {
      method: "POST",
      headers: { cookie: memberCookie },
    })
  );
  if (acc.status !== 200) {
    throw new Error(`invite accept failed with status ${acc.status}`);
  }
  return memberCookie;
}

function del(path: string, cookie?: string) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: "DELETE",
      headers: cookie ? { cookie } : undefined,
    })
  );
}

function getContract(contractId: string, cookie: string) {
  return app.handle(
    new Request(`http://localhost/api/contracts/${contractId}`, {
      headers: { cookie },
    })
  );
}

describe("DELETE /api/contracts/:id", () => {
  it("owner exclui o contrato (some para todos)", async () => {
    const owner = await signUp(uniqueEmail("del-owner"));
    const contractId = await createContract(owner);

    const res = await del(`/api/contracts/${contractId}`, owner);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    expect((await getContract(contractId, owner)).status).toBe(404);
  });

  it("participante não-dono recebe 403", async () => {
    const owner = await signUp(uniqueEmail("del-fo"));
    const contractId = await createContract(owner);
    const member = await joinAsMember(owner, contractId);

    expect((await del(`/api/contracts/${contractId}`, member)).status).toBe(
      403
    );
    expect((await getContract(contractId, owner)).status).toBe(200);
  });

  it("estranho recebe 404 (não vaza)", async () => {
    const owner = await signUp(uniqueEmail("del-leak-o"));
    const contractId = await createContract(owner);
    const stranger = await signUp(uniqueEmail("del-leak-s"));

    expect((await del(`/api/contracts/${contractId}`, stranger)).status).toBe(
      404
    );
  });

  it("não autenticado recebe 401", async () => {
    const owner = await signUp(uniqueEmail("del-unauth"));
    const contractId = await createContract(owner);

    expect((await del(`/api/contracts/${contractId}`)).status).toBe(401);
  });
});

describe("DELETE /api/contracts/:id/me (sair)", () => {
  it("participante não-dono sai e perde o acesso", async () => {
    const owner = await signUp(uniqueEmail("leave-o"));
    const contractId = await createContract(owner);
    const member = await joinAsMember(owner, contractId);

    expect((await getContract(contractId, member)).status).toBe(200);

    const res = await del(`/api/contracts/${contractId}/me`, member);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    expect((await getContract(contractId, member)).status).toBe(404);
    expect((await getContract(contractId, owner)).status).toBe(200);
  });

  it("dono não pode sair (use excluir) → 403", async () => {
    const owner = await signUp(uniqueEmail("leave-owner"));
    const contractId = await createContract(owner);

    expect((await del(`/api/contracts/${contractId}/me`, owner)).status).toBe(
      403
    );
  });

  it("estranho recebe 404 (não vaza)", async () => {
    const owner = await signUp(uniqueEmail("leave-leak-o"));
    const contractId = await createContract(owner);
    const stranger = await signUp(uniqueEmail("leave-leak-s"));

    expect(
      (await del(`/api/contracts/${contractId}/me`, stranger)).status
    ).toBe(404);
  });

  it("não autenticado recebe 401", async () => {
    const owner = await signUp(uniqueEmail("leave-unauth"));
    const contractId = await createContract(owner);

    expect((await del(`/api/contracts/${contractId}/me`)).status).toBe(401);
  });
});
