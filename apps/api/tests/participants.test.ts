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

describe("POST /api/contracts/:id/participants", () => {
  it("owner adiciona participante com sucesso", async () => {
    const owner = await signUpCookie("po-add");
    const contractId = await createContract(owner);

    const res = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner },
        body: JSON.stringify({ displayName: "Irmão", role: "seller" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.id).toBe("string");
  });

  it("estranho recebe 404 (não vaza existência)", async () => {
    const owner = await signUpCookie("po-leak");
    const contractId = await createContract(owner);

    const stranger = await signUpCookie("ps-leak");
    const res = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: stranger },
        body: JSON.stringify({ displayName: "X", role: "viewer" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("role inválido retorna erro de validação", async () => {
    const owner = await signUpCookie("po-invalid");
    const contractId = await createContract(owner);

    const res = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner },
        body: JSON.stringify({ displayName: "Teste", role: "owner" }),
      })
    );
    expect(res.status).toBe(422);
  });

  it("papéis buyer/seller são únicos; viewer é ilimitado", async () => {
    const owner = await signUpCookie("po-uniq");
    const contractId = await createContract(owner); // dono ocupa o slot buyer

    const add = (role: string, name: string) =>
      app.handle(
        new Request(
          `http://localhost/api/contracts/${contractId}/participants`,
          {
            method: "POST",
            headers: { "content-type": "application/json", cookie: owner },
            body: JSON.stringify({ displayName: name, role }),
          }
        )
      );

    // owner já é buyer → segundo buyer é rejeitado
    expect((await add("buyer", "B2")).status).toBe(422);
    // primeiro seller passa, segundo é rejeitado
    expect((await add("seller", "V1")).status).toBe(200);
    expect((await add("seller", "V2")).status).toBe(422);
    // viewer é ilimitado
    expect((await add("viewer", "C1")).status).toBe(200);
    expect((await add("viewer", "C2")).status).toBe(200);
  });

  it("não autenticado retorna 401", async () => {
    const owner = await signUpCookie("po-unauth");
    const contractId = await createContract(owner);

    const res = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: "X", role: "viewer" }),
      })
    );
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/contracts/:id/participants/:participantId", () => {
  it("owner remove participante com sucesso", async () => {
    const owner = await signUpCookie("po-del");
    const contractId = await createContract(owner);

    const addRes = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner },
        body: JSON.stringify({ displayName: "Temporário", role: "viewer" }),
      })
    );
    expect(addRes.status).toBe(200);
    const { id: participantId } = await addRes.json();

    const delRes = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/${participantId}`,
        { method: "DELETE", headers: { cookie: owner } }
      )
    );
    expect(delRes.status).toBe(200);
    const body = await delRes.json();
    expect(body.ok).toBe(true);
  });

  it("estranho recebe 404 ao tentar remover participante", async () => {
    const owner = await signUpCookie("po-del-leak");
    const contractId = await createContract(owner);

    const addRes = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner },
        body: JSON.stringify({ displayName: "Alvo", role: "viewer" }),
      })
    );
    expect(addRes.status).toBe(200);
    const { id: participantId } = await addRes.json();

    const stranger = await signUpCookie("ps-del-leak");
    const res = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/${participantId}`,
        { method: "DELETE", headers: { cookie: stranger } }
      )
    );
    expect(res.status).toBe(404);
  });

  it("o dono não pode ser removido (403) mesmo com papel buyer/seller", async () => {
    const owner = await signUpCookie("po-del-owner");
    const contractId = await createContract(owner);

    const detail = await (
      await app.handle(
        new Request(`http://localhost/api/contracts/${contractId}`, {
          headers: { cookie: owner },
        })
      )
    ).json();
    const ownerParticipant = detail.participants.find(
      (p: { isOwner: boolean }) => p.isOwner
    );
    expect(ownerParticipant).toBeTruthy();
    expect(ownerParticipant.role).not.toBe("owner");

    const res = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/${ownerParticipant.id}`,
        { method: "DELETE", headers: { cookie: owner } }
      )
    );
    expect(res.status).toBe(403);
  });

  it("participante inexistente retorna 404", async () => {
    const owner = await signUpCookie("po-del-notfound");
    const contractId = await createContract(owner);

    const res = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/00000000-0000-0000-0000-000000000000`,
        { method: "DELETE", headers: { cookie: owner } }
      )
    );
    expect(res.status).toBe(404);
  });
});

function addParticipant(
  contractId: string,
  cookie: string,
  role: string,
  name: string
) {
  return app.handle(
    new Request(`http://localhost/api/contracts/${contractId}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ displayName: name, role }),
    })
  );
}

async function getDetail(contractId: string, cookie: string) {
  return (
    await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}`, {
        headers: { cookie },
      })
    )
  ).json();
}

function patchRole(
  contractId: string,
  participantId: string,
  cookie: string,
  role: string
) {
  return app.handle(
    new Request(
      `http://localhost/api/contracts/${contractId}/participants/${participantId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ role }),
      }
    )
  );
}

describe("PATCH /api/contracts/:id/participants/:participantId", () => {
  it("owner altera o papel de um participante com sucesso", async () => {
    const owner = await signUpCookie("pr-ok");
    const contractId = await createContract(owner);

    const { id: participantId } = await (
      await addParticipant(contractId, owner, "viewer", "Convidado")
    ).json();

    const res = await patchRole(contractId, participantId, owner, "seller");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("seller");

    const detail = await getDetail(contractId, owner);
    const updated = detail.participants.find(
      (p: { id: string }) => p.id === participantId
    );
    expect(updated.role).toBe("seller");
  });

  it("rejeita papel já ocupado (422)", async () => {
    const owner = await signUpCookie("pr-uniq");
    const contractId = await createContract(owner);

    await addParticipant(contractId, owner, "seller", "Vendedor");
    const { id: viewerId } = await (
      await addParticipant(contractId, owner, "viewer", "Convidado")
    ).json();

    const res = await patchRole(contractId, viewerId, owner, "seller");
    expect(res.status).toBe(422);
  });

  it("o slot do dono não pode virar viewer (422)", async () => {
    const owner = await signUpCookie("pr-owner-viewer");
    const contractId = await createContract(owner);

    const detail = await getDetail(contractId, owner);
    const ownerParticipant = detail.participants.find(
      (p: { isOwner: boolean }) => p.isOwner
    );
    expect(ownerParticipant).toBeTruthy();

    const res = await patchRole(
      contractId,
      ownerParticipant.id,
      owner,
      "viewer"
    );
    expect(res.status).toBe(422);
  });

  it("o dono pode trocar o próprio papel buyer→seller (200)", async () => {
    const owner = await signUpCookie("pr-owner-swap");
    const contractId = await createContract(owner); // dono é buyer

    const detail = await getDetail(contractId, owner);
    const ownerParticipant = detail.participants.find(
      (p: { isOwner: boolean }) => p.isOwner
    );
    expect(ownerParticipant.role).toBe("buyer");

    const res = await patchRole(
      contractId,
      ownerParticipant.id,
      owner,
      "seller"
    );
    expect(res.status).toBe(200);

    const after = await getDetail(contractId, owner);
    const ownerAfter = after.participants.find(
      (p: { isOwner: boolean }) => p.isOwner
    );
    expect(ownerAfter.role).toBe("seller");
  });

  it("dono não pode trocar para papel já ocupado por outro participante (422)", async () => {
    const owner = await signUpCookie("pr-owner-taken");
    const contractId = await createContract(owner); // dono é buyer

    // Adiciona um participante com papel seller
    await addParticipant(contractId, owner, "seller", "Vendedor");

    // Localiza o participante do dono via detalhe do contrato
    const detail = await getDetail(contractId, owner);
    const ownerParticipant = detail.participants.find(
      (p: { isOwner: boolean }) => p.isOwner
    );
    expect(ownerParticipant).toBeTruthy();
    expect(ownerParticipant.role).toBe("buyer");

    // Dono tenta trocar para seller (já ocupado por outro) → deve retornar 422
    const res = await patchRole(
      contractId,
      ownerParticipant.id,
      owner,
      "seller"
    );
    expect(res.status).toBe(422);
  });

  it("estranho recebe 404 (não vaza existência)", async () => {
    const owner = await signUpCookie("pr-leak");
    const contractId = await createContract(owner);

    const { id: participantId } = await (
      await addParticipant(contractId, owner, "viewer", "Alvo")
    ).json();

    const stranger = await signUpCookie("pr-leak-2");
    const res = await patchRole(contractId, participantId, stranger, "seller");
    expect(res.status).toBe(404);
  });

  it("participante inexistente retorna 404", async () => {
    const owner = await signUpCookie("pr-notfound");
    const contractId = await createContract(owner);

    const res = await patchRole(
      contractId,
      "00000000-0000-0000-0000-000000000000",
      owner,
      "seller"
    );
    expect(res.status).toBe(404);
  });

  it("papel inválido retorna 422 (rejeição do TypeBox)", async () => {
    const owner = await signUpCookie("pr-invalid");
    const contractId = await createContract(owner);

    const { id: participantId } = await (
      await addParticipant(contractId, owner, "viewer", "Alvo")
    ).json();

    expect(
      (await patchRole(contractId, participantId, owner, "owner")).status
    ).toBe(422);
    expect(
      (await patchRole(contractId, participantId, owner, "garbage")).status
    ).toBe(422);
  });
});

describe("POST /api/contracts/:id/participants/:participantId/invite", () => {
  it("owner gera convite com token e expiração", async () => {
    const owner = await signUpCookie("inv");
    const contractId = await createContract(owner);

    const addRes = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner },
        body: JSON.stringify({ displayName: "Irmão", role: "seller" }),
      })
    );
    expect(addRes.status).toBe(200);
    const { id: participantId } = await addRes.json();

    const res = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/${participantId}/invite`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: owner },
          body: JSON.stringify({ email: "irmao@example.com" }),
        }
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toHaveLength(64); // 32 bytes em hex
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("estranho recebe 404 ao tentar gerar convite (não vaza existência)", async () => {
    const owner = await signUpCookie("inv-stranger");
    const contractId = await createContract(owner);

    const addRes = await app.handle(
      new Request(`http://localhost/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner },
        body: JSON.stringify({ displayName: "Convidado", role: "seller" }),
      })
    );
    expect(addRes.status).toBe(200);
    const { id: participantId } = await addRes.json();

    const stranger = await signUpCookie("inv-stranger-2");
    const res = await app.handle(
      new Request(
        `http://localhost/api/contracts/${contractId}/participants/${participantId}/invite`,
        {
          method: "POST",
          headers: { "content-type": "application/json", cookie: stranger },
          body: JSON.stringify({ email: "stranger@example.com" }),
        }
      )
    );
    expect(res.status).toBe(404);
  });
});
