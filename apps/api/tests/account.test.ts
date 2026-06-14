import { describe, expect, it } from "bun:test";
import { buildUserExport, type ExportInput } from "../src/lib/account-export";

const input: ExportInput = {
  exportedAt: "2026-07-15T00:00:00.000Z",
  profile: { id: "u1", name: "Eu", email: "eu@e.com" },
  ownedContracts: [
    {
      contract: { id: "c1", title: "Aluguel" },
      installments: [
        {
          sequence: 1,
          amountCents: 1000,
          dueDate: "2026-07-10",
          status: "pending",
        },
      ],
      participants: [{ displayName: "Eu", role: "buyer" }],
      auditEvents: [
        { type: "proof_submitted", createdAt: "2026-07-01T00:00:00.000Z" },
      ],
      proofs: [{ fileName: "c.pdf", createdAt: "2026-07-01T00:00:00.000Z" }],
    },
  ],
  participatingContracts: [
    {
      contract: { id: "c2", title: "Venda" },
      mySlot: "seller",
      installments: [
        {
          sequence: 1,
          amountCents: 2000,
          dueDate: "2026-08-10",
          status: "paid",
        },
      ],
    },
  ],
  notifications: [
    {
      type: "payment_confirmed",
      contractId: "c1",
      installmentId: "i1",
      readAt: null,
      createdAt: "2026-07-02T00:00:00.000Z",
    },
  ],
};

describe("buildUserExport", () => {
  it("assembles the export object with all sections", () => {
    const out = buildUserExport(input);
    expect(out.profile.email).toBe("eu@e.com");
    expect(out.ownedContracts).toHaveLength(1);
    expect(out.ownedContracts[0]?.contract.title).toBe("Aluguel");
    expect(out.participatingContracts[0]?.mySlot).toBe("seller");
    expect(out.notifications).toHaveLength(1);
    expect(out.exportedAt).toBe("2026-07-15T00:00:00.000Z");
  });
});
