import { describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { signUpCookie, uniqueEmail } from "./helpers/auth";
import { partyScenario } from "./helpers/party-scenario";

function createContract(cookie: string, title: string, description?: string) {
  return app.handle(
    new Request("http://localhost/api/contracts", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        title,
        description,
        ownerRole: "seller",
        requiresConfirmation: false,
        schedule: {
          mode: "auto",
          totalAmountCents: 300_000,
          installmentsCount: 3,
          firstDueDate: "2026-09-10",
        },
      }),
    })
  );
}

function listContracts(cookie: string) {
  return app.handle(
    new Request("http://localhost/api/contracts", { headers: { cookie } })
  );
}

describe("GET /api/contracts — campos da busca ⌘K", () => {
  it("devolve description quando informada e null quando não", async () => {
    const cookie = await signUpCookie(uniqueEmail("desc"));
    await createContract(cookie, "Com descrição", "Aluguel do apê da praia");
    await createContract(cookie, "Sem descrição");

    const body = await (await listContracts(cookie)).json();
    const comDesc = body.find(
      (c: { title: string }) => c.title === "Com descrição"
    );
    const semDesc = body.find(
      (c: { title: string }) => c.title === "Sem descrição"
    );

    expect(comDesc.description).toBe("Aluguel do apê da praia");
    expect(semDesc.description).toBeNull();
  });

  it("devolve participantNames com o dono do contrato", async () => {
    const cookie = await signUpCookie(uniqueEmail("names"));
    await createContract(cookie, "Com participante");

    const body = await (await listContracts(cookie)).json();
    const item = body.find(
      (c: { title: string }) => c.title === "Com participante"
    );

    expect(Array.isArray(item.participantNames)).toBe(true);
    expect(item.participantNames.length).toBeGreaterThan(0);
    expect(
      item.participantNames.every((n: string) => typeof n === "string")
    ).toBe(true);
  });

  it("devolve nextDueDate = primeira parcela não paga", async () => {
    const cookie = await signUpCookie(uniqueEmail("next"));
    await createContract(cookie, "Com vencimento");

    const body = await (await listContracts(cookie)).json();
    const item = body.find(
      (c: { title: string }) => c.title === "Com vencimento"
    );

    expect(item.nextDueDate).toBe("2026-09-10");
  });

  it("não regride os campos que a resposta já tinha", async () => {
    const cookie = await signUpCookie(uniqueEmail("shape"));
    await createContract(cookie, "Forma");

    const body = await (await listContracts(cookie)).json();
    const item = body.find((c: { title: string }) => c.title === "Forma");

    expect(item).toMatchObject({
      title: "Forma",
      ownerRole: "seller",
      installmentsCount: 3,
    });
    expect(typeof item.percent).toBe("number");
    expect(typeof item.overdueCount).toBe("number");
  });
});

describe("GET /api/contracts — o cartão da lista", () => {
  it("só os contratos visíveis, com direction null para quem acompanha", async () => {
    const s = await partyScenario("Cartão visível");
    const ofOwner = await (await listContracts(s.owner)).json();
    expect(ofOwner.find((c: { id: string }) => c.id === s.id)).toMatchObject({
      direction: "receive",
      counterpartyName: "Rafael Prado",
    });
    const ofPayer = await (await listContracts(s.payer)).json();
    expect(ofPayer.find((c: { id: string }) => c.id === s.id)).toMatchObject({
      direction: "pay",
    });
    const ofViewer = await (await listContracts(s.viewer)).json();
    expect(ofViewer.find((c: { id: string }) => c.id === s.id)).toMatchObject({
      direction: null,
      counterpartyName: null,
    });
    const ofOutsider = await (await listContracts(s.outsider)).json();
    expect(ofOutsider).toEqual([]);
  });

  it("sem sessão, 401", async () => {
    const res = await app.handle(new Request("http://localhost/api/contracts"));
    expect(res.status).toBe(401);
  });

  it("o cartão de um contrato recém-criado: paidCount 0, remainingCents = total, next = parcela 1", async () => {
    const cookie = await signUpCookie(uniqueEmail("fresh"));
    await createContract(cookie, "Recém-criado");
    const body = await (await listContracts(cookie)).json();
    const item = body.find(
      (c: { title: string }) => c.title === "Recém-criado"
    );
    expect(item).toMatchObject({
      paidCount: 0,
      remainingCents: 300_000,
      settled: false,
      monthly: false,
      installmentAmountCents: 100_000,
      next: { sequence: 1, dueDate: "2026-09-10", amountCents: 100_000 },
      endDate: "2026-11-10",
    });
    expect(item.statuses).toHaveLength(3);
  });

  it("a ordem é do mais novo para o mais antigo", async () => {
    const cookie = await signUpCookie(uniqueEmail("order"));
    await createContract(cookie, "Primeiro");
    await createContract(cookie, "Segundo");
    const body = await (await listContracts(cookie)).json();
    expect(body.map((c: { title: string }) => c.title)).toEqual([
      "Segundo",
      "Primeiro",
    ]);
  });
});
