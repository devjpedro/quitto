import { describe, expect, it } from "bun:test";
import {
  type InstallmentAction,
  type InstallmentStatus,
  nextStatus,
} from "../src/lib/installment-state";

const cases: [
  InstallmentStatus,
  InstallmentAction,
  boolean,
  InstallmentStatus,
][] = [
  ["pending", "submit_proof", true, "awaiting_confirmation"],
  ["awaiting_confirmation", "confirm", true, "confirmed"],
  ["awaiting_confirmation", "dispute", true, "disputed"],
  ["disputed", "submit_proof", true, "awaiting_confirmation"],
  ["pending", "submit_proof", false, "paid"],
  ["pending", "mark_paid", false, "paid"],
  ["pending", "mark_received", true, "confirmed"],
  ["disputed", "mark_received", true, "confirmed"],
  ["pending", "mark_received", false, "paid"],
];

describe("nextStatus", () => {
  for (const [from, action, requiresConfirmation, expected] of cases) {
    it(`${from} --${action}(conf=${requiresConfirmation})--> ${expected}`, () => {
      expect(nextStatus(from, action, requiresConfirmation)).toBe(expected);
    });
  }

  it("rejects confirm when no confirmation is required", () => {
    expect(() => nextStatus("pending", "confirm", false)).toThrow();
  });

  it("rejects confirming an already confirmed installment", () => {
    expect(() => nextStatus("confirmed", "confirm", true)).toThrow();
  });

  it("rejects mark_paid when confirmation is required", () => {
    expect(() => nextStatus("pending", "mark_paid", true)).toThrow();
  });

  it("mark_received com comprovante esperando é 'Confirmar', não 'marcar'", () => {
    expect(() =>
      nextStatus("awaiting_confirmation", "mark_received", true)
    ).toThrow();
  });

  it("mark_received de parcela já paga ou confirmada é recusado", () => {
    expect(() => nextStatus("paid", "mark_received", false)).toThrow();
    expect(() => nextStatus("confirmed", "mark_received", true)).toThrow();
  });
});
