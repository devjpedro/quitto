import { describe, expect, it } from "bun:test";
import {
  buildReceiptModel,
  buildStatementModel,
  type ModelContract,
  type ModelInstallment,
  type ModelParticipant,
} from "../src/lib/documents/model";

const contract: ModelContract = {
  title: "Aluguel",
  installmentsCount: 2,
};
const participants: ModelParticipant[] = [
  { role: "buyer", displayName: "Comprador" },
  { role: "seller", displayName: "Vendedor" },
];
const today = "2026-07-15";

const mkInst = (over: Partial<ModelInstallment>): ModelInstallment => ({
  sequence: 1,
  amountCents: 1000,
  dueDate: "2026-07-10",
  status: "pending",
  paidAt: null,
  ...over,
});

describe("buildStatementModel", () => {
  it("maps parties by slot and builds rows sorted by sequence", () => {
    const model = buildStatementModel(
      contract,
      [mkInst({ sequence: 2, dueDate: "2026-08-10" }), mkInst({ sequence: 1 })],
      participants,
      today
    );
    expect(model.parties).toEqual({
      payerName: "Comprador",
      receiverName: "Vendedor",
    });
    expect(model.rows.map((r) => r.sequence)).toEqual([1, 2]);
    expect(model.isFullyPaid).toBe(false);
  });

  it("flags fully paid and the last paid date", () => {
    const model = buildStatementModel(
      contract,
      [
        mkInst({ sequence: 1, status: "paid", paidAt: "2026-07-01" }),
        mkInst({ sequence: 2, status: "confirmed", paidAt: "2026-07-12" }),
      ],
      participants,
      today
    );
    expect(model.isFullyPaid).toBe(true);
    expect(model.fullyPaidAt).toBe("2026-07-12");
  });
});

describe("buildReceiptModel", () => {
  it("builds receipt fields from a paid installment", () => {
    const model = buildReceiptModel(
      contract,
      mkInst({
        sequence: 1,
        status: "paid",
        paidAt: "2026-07-12",
        amountCents: 5000,
      }),
      participants
    );
    expect(model.sequence).toBe(1);
    expect(model.installmentsCount).toBe(2);
    expect(model.amountCents).toBe(5000);
    expect(model.paidAt).toBe("2026-07-12");
    expect(model.parties.payerName).toBe("Comprador");
  });
});
