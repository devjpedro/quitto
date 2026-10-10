import { describe, expect, it } from "bun:test";
import { latestDispute, proofStates } from "../src/lib/installment-detail";

const at = (iso: string) => new Date(iso);

describe("proofStates", () => {
  it("o comprovante seguido de contestação é 'disputed', com o motivo; o reenvio é o atual", () => {
    const states = proofStates(
      [
        { id: "second", createdAt: at("2026-07-31T11:40:00Z") },
        { id: "first", createdAt: at("2026-07-30T22:30:00Z") },
      ],
      [
        {
          type: "proof_submitted",
          createdAt: at("2026-07-30T22:30:00Z"),
          metadata: null,
        },
        {
          type: "payment_disputed",
          createdAt: at("2026-07-31T00:05:00Z"),
          metadata: { reason: "É o da parcela 1" },
        },
        {
          type: "payment_confirmed",
          createdAt: at("2026-07-31T12:12:00Z"),
          metadata: null,
        },
      ]
    );
    expect(states.get("first")).toEqual({
      state: "disputed",
      reason: "É o da parcela 1",
    });
    expect(states.get("second")).toEqual({ state: "current", reason: null });
  });

  it("contestação sem motivo: 'disputed' com motivo nulo", () => {
    const states = proofStates(
      [{ id: "only", createdAt: at("2026-10-04T13:00:00Z") }],
      [
        {
          type: "payment_disputed",
          createdAt: at("2026-10-04T14:00:00Z"),
          metadata: null,
        },
      ]
    );
    expect(states.get("only")).toEqual({ state: "disputed", reason: null });
  });

  it("um comprovante só, sem contestação, é o atual", () => {
    expect(
      proofStates(
        [{ id: "only", createdAt: at("2026-10-04T13:00:00Z") }],
        []
      ).get("only")
    ).toEqual({ state: "current", reason: null });
  });
});

describe("latestDispute", () => {
  const events = [
    {
      type: "payment_disputed",
      createdAt: at("2026-07-31T00:05:00Z"),
      actorUserId: "u-joao",
      actorName: "João Souza",
      metadata: { reason: "Esse comprovante é o da parcela 1." },
    },
    {
      type: "proof_submitted",
      createdAt: at("2026-07-30T22:30:00Z"),
      actorUserId: "u-rafa",
      actorName: "Rafael Prado",
      metadata: null,
    },
  ];

  it("só existe com a parcela contestada: o último evento de contestação, achatado", () => {
    expect(latestDispute("disputed", events, "u-rafa")).toEqual({
      reason: "Esse comprovante é o da parcela 1.",
      byName: "João Souza",
      byMe: false,
      at: "2026-07-31T00:05:00.000Z",
    });
  });

  it("parcela que não está contestada: null", () => {
    expect(latestDispute("confirmed", events, "u-rafa")).toBeNull();
  });
});
