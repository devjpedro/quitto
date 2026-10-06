import { describe, expect, it } from "vitest";
import {
  counterpartLine,
  heroView,
  perspectiveOf,
  termsLine,
} from "@/features/contracts/lib/contract-view";

const monthly = (n: number, day: string, cents = 48_000) =>
  Array.from({ length: n }, (_, i) => ({
    amountCents: cents,
    dueDate: `2026-${String(i + 6).padStart(2, "0")}-${day}`.replace(
      "2026-13",
      "2027-01"
    ),
  }));

describe("perspectiveOf", () => {
  it("seller recebe, buyer paga, viewer acompanha", () => {
    expect(perspectiveOf("seller")).toBe("receive");
    expect(perspectiveOf("buyer")).toBe("pay");
    expect(perspectiveOf("viewer")).toBe("view");
  });
});

describe("termsLine (o único lugar das condições)", () => {
  it("mensal com o mesmo valor: 'R$ 480,00 todo dia 30 · 7 parcelas · com confirmação'", () => {
    expect(termsLine(monthly(7, "30"), true, "pt-BR")).toBe(
      "R$ 480,00 todo dia 30 · 7 parcelas · com confirmação"
    );
  });

  it("dia 30 preso ao fim de fevereiro continua 'todo dia 30'", () => {
    const items = [
      { amountCents: 100, dueDate: "2027-01-30" },
      { amountCents: 100, dueDate: "2027-02-28" },
      { amountCents: 100, dueDate: "2027-03-30" },
    ];
    expect(termsLine(items, false, "pt-BR")).toBe(
      "R$ 1,00 todo dia 30 · 3 parcelas"
    );
  });

  it("valores diferentes: o total; uma parcela só: no singular", () => {
    expect(
      termsLine(
        [
          { amountCents: 100, dueDate: "2026-10-05" },
          { amountCents: 300, dueDate: "2026-11-05" },
        ],
        false,
        "pt-BR"
      )
    ).toBe("R$ 4,00 no total · 2 parcelas");
    expect(
      termsLine(
        [{ amountCents: 29_000, dueDate: "2026-10-05" }],
        false,
        "pt-BR"
      )
    ).toBe("R$ 290,00 cada · 1 parcela");
  });
});

describe("heroView", () => {
  const progress = {
    totalCents: 480_000,
    paidCents: 96_000,
    remainingCents: 384_000,
    percent: 20,
    overdueCount: 1,
  };
  it("falta receber / pagar / quitar, com o total embaixo", () => {
    const installments = [{ status: "pending" }];
    expect(heroView({ progress, installments }, "receive")).toEqual({
      label: "Falta receber",
      cents: 384_000,
      ofCents: 480_000,
    });
    expect(heroView({ progress, installments }, "pay").label).toBe(
      "Falta pagar"
    );
    expect(heroView({ progress, installments }, "view").label).toBe(
      "Falta quitar"
    );
  });

  it("quitado: 'Recebido' com o total e nada embaixo", () => {
    const settled = { ...progress, paidCents: 480_000, remainingCents: 0 };
    expect(
      heroView(
        { progress: settled, installments: [{ status: "paid" }] },
        "receive"
      )
    ).toEqual({ label: "Recebido", cents: 480_000, ofCents: null });
  });
});

describe("counterpartLine", () => {
  const people = [
    { displayName: "João Souza", role: "seller", isMe: true },
    { displayName: "Rafael Prado", role: "buyer", isMe: false },
  ];
  it("quem recebe vê quem paga; quem paga vê quem recebe; o espectador vê os dois", () => {
    expect(counterpartLine(people, "receive")).toEqual({
      kind: "receive",
      name: "Rafael Prado",
    });
    expect(counterpartLine(people, "pay")).toEqual({
      kind: "pay",
      name: "João Souza",
    });
    expect(counterpartLine(people, "view")).toEqual({
      kind: "view",
      payer: "Rafael Prado",
      receiver: "João Souza",
    });
  });

  it("sem a outra parte: nada a dizer", () => {
    const alone = [{ displayName: "João Souza", role: "seller", isMe: true }];
    expect(counterpartLine(alone, "receive")).toEqual({ kind: "alone" });
  });
});
