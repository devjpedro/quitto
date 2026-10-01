import { describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { signUpCookie, uniqueEmail } from "./helpers/auth";

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
