import { describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { call, partyScenario } from "./helpers/party-scenario";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

describe("GET /api/installments", () => {
  it("sem sessão, 401", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/installments")
    );
    expect(res.status).toBe(401);
  });

  it("só as parcelas de quem pede; o contrato acompanhado fica fora", async () => {
    const s = await partyScenario("Lista de parcelas");
    const ofOwner = await (await call(s.owner, "/api/installments")).json();
    expect(ofOwner.hasContracts).toBe(true);
    expect(ofOwner.items).toHaveLength(3);
    expect(ofOwner.items[0]).toMatchObject({
      contractId: s.id,
      contractTitle: "Lista de parcelas",
      installmentsCount: 3,
      sequence: 1,
      amountCents: 30_000,
      dueDate: "2026-08-30",
      direction: "receive",
    });
    const ofViewer = await (await call(s.viewer, "/api/installments")).json();
    expect(ofViewer).toMatchObject({ hasContracts: false, items: [] });
    const ofOutsider = await (
      await call(s.outsider, "/api/installments")
    ).json();
    expect(ofOutsider).toMatchObject({ hasContracts: false, items: [] });
    expect(ofOutsider.today).toMatch(ISO_DATE_RE);
  });

  it("o lado de quem paga e de quem recebe no mesmo contrato", async () => {
    const s = await partyScenario("Dois lados");
    const pay = await (await call(s.payer, "/api/installments")).json();
    const receive = await (await call(s.owner, "/api/installments")).json();
    expect(pay.items[0]).toMatchObject({
      direction: "pay",
      counterpartyName: expect.any(String),
    });
    expect(receive.items[0]).toMatchObject({
      direction: "receive",
      counterpartyName: "Rafael Prado",
    });
    expect(pay.items[0].counterpartyName).not.toBe("Rafael Prado");
    const filtered = await (
      await call(s.owner, "/api/installments?direction=pay")
    ).json();
    expect(filtered.items).toEqual([]);
  });

  it("filtra por janela e traz as atrasadas com pastDue", async () => {
    const s = await partyScenario("Janela");
    const body = await (
      await call(
        s.owner,
        "/api/installments?from=2026-09-15&to=2026-09-30&pastDue=include"
      )
    ).json();
    // 08-30 is unpaid and before `from`; 09-30 is inside the window; 10-30 is after `to`.
    expect(body.items.map((i: { dueDate: string }) => i.dueDate)).toEqual([
      "2026-08-30",
      "2026-09-30",
    ]);
  });

  it("from depois de to: 422", async () => {
    const s = await partyScenario("Janela invertida");
    const res = await call(
      s.owner,
      "/api/installments?from=2026-10-10&to=2026-10-01"
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("VALIDATION");
  });

  it("data malformada: 422", async () => {
    const s = await partyScenario("Data ruim");
    expect((await call(s.owner, "/api/installments?from=ontem")).status).toBe(
      422
    );
  });

  it("o detalhe da parcela continua respondendo", async () => {
    const s = await partyScenario("Detalhe");
    const list = await (await call(s.owner, "/api/installments")).json();
    const res = await call(
      s.owner,
      `/api/installments/${list.items[0].installmentId}`
    );
    expect(res.status).toBe(200);
  });
});
