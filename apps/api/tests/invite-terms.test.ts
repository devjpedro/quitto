import { describe, expect, it } from "bun:test";
import { toInviteTerms } from "../src/lib/invite-terms";

const row = {
  firstDueDate: "2026-11-10",
  lastDueDate: "2027-02-10",
  installmentsCount: 4,
  totalCents: 120_000,
  minCents: 30_000,
  maxCents: 30_000,
  minDay: 10,
  maxDay: 10,
  paidSequences: [],
};

describe("toInviteTerms", () => {
  it("valores iguais e o mesmo dia: o valor da parcela e o dia", () => {
    expect(toInviteTerms(row)).toEqual({
      amountCents: 30_000,
      dayOfMonth: 10,
      firstDueDate: "2026-11-10",
      installmentsCount: 4,
      lastDueDate: "2027-02-10",
      maxCents: 30_000,
      minCents: 30_000,
      paidSequences: [],
      totalCents: 120_000,
    });
  });

  it("valores diferentes: amountCents nulo (a frase mostra o total)", () => {
    expect(toInviteTerms({ ...row, maxCents: 40_000 }).amountCents).toBeNull();
  });

  it("dias diferentes (um 31 que vira 30): dayOfMonth nulo", () => {
    expect(
      toInviteTerms({ ...row, minDay: 30, maxDay: 31 }).dayOfMonth
    ).toBeNull();
  });

  it("sem soma: total zero", () => {
    expect(toInviteTerms({ ...row, totalCents: null }).totalCents).toBe(0);
  });
});
