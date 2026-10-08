import { describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { signUpCookie, uniqueEmail } from "./helpers/auth";
import { call, partyScenario } from "./helpers/party-scenario";

describe("GET /api/people", () => {
  it("sem sessão, 401", async () => {
    const res = await app.handle(new Request("http://localhost/api/people"));
    expect(res.status).toBe(401);
  });

  it("duas contas num contrato: cada uma vê a outra, com o lado certo", async () => {
    const s = await partyScenario("Moto das pessoas");
    const ofOwner = await (await call(s.owner, "/api/people")).json();
    expect(ofOwner.people).toHaveLength(1);
    expect(ofOwner.people[0]).toMatchObject({
      name: "Rafael Prado",
      account: "linked",
      owesYouCents: 90_000,
      youOweCents: 0,
    });
    expect(ofOwner.people[0].contracts[0]).toMatchObject({
      contractId: s.id,
      direction: "receive",
    });
    const ofPayer = await (await call(s.payer, "/api/people")).json();
    expect(ofPayer.people).toHaveLength(1);
    expect(ofPayer.people[0]).toMatchObject({
      account: "linked",
      owesYouCents: 0,
      youOweCents: 90_000,
    });
    expect(ofPayer.people[0].name).not.toBe("Rafael Prado");
  });

  it("o e-mail só vai para quem é dono de um contrato com a pessoa", async () => {
    const s = await partyScenario("E-mail das pessoas");
    const ofOwner = await (await call(s.owner, "/api/people")).json();
    expect(ofOwner.people[0].email).toBe(s.payerEmail);
    const ofPayer = await (await call(s.payer, "/api/people")).json();
    expect(ofPayer.people[0].email).toBeNull();
    // The owner's e-mail ("party-owner…") is nowhere in what the payer gets.
    expect(JSON.stringify(ofPayer)).not.toContain("party-owner");
  });

  it("quem só acompanha e quem não tem contrato não veem ninguém", async () => {
    const s = await partyScenario("Sem espectador");
    expect(await (await call(s.viewer, "/api/people")).json()).toEqual({
      people: [],
    });
    expect(await (await call(s.outsider, "/api/people")).json()).toEqual({
      people: [],
    });
  });

  it("um convite pendente aparece como convidado, com o e-mail só para o dono", async () => {
    const owner = await signUpCookie(uniqueEmail("people-invite-owner"));
    const created = await call(owner, "/api/contracts", "POST", {
      title: "Câmera",
      ownerRole: "seller",
      requiresConfirmation: false,
      schedule: {
        mode: "auto",
        totalAmountCents: 20_000,
        installmentsCount: 2,
        firstDueDate: "2026-12-10",
      },
      counterparty: { name: "Júlia Nogueira", email: "julia@exemplo.com" },
    });
    expect(created.status).toBe(200);
    const body = await (await call(owner, "/api/people")).json();
    expect(body.people).toHaveLength(1);
    expect(body.people[0]).toMatchObject({
      name: "Júlia Nogueira",
      account: "invited",
      email: "julia@exemplo.com",
    });
  });
});
