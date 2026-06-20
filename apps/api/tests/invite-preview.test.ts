import { describe, expect, it } from "bun:test";
import { buildInvitePreview } from "../src/lib/invite-preview";

describe("buildInvitePreview", () => {
  it("soma o total, conta parcelas e devolve as partes", () => {
    const out = buildInvitePreview({
      installments: [{ amountCents: 1000 }, { amountCents: 2000 }],
      participants: [
        { displayName: "Ana", role: "buyer" },
        { displayName: "Bia", role: "seller" },
      ],
    });
    expect(out.totalAmountCents).toBe(3000);
    expect(out.installmentsCount).toBe(2);
    expect(out.parties).toHaveLength(2);
  });

  it("lida com contrato sem parcelas", () => {
    const out = buildInvitePreview({ installments: [], participants: [] });
    expect(out.totalAmountCents).toBe(0);
    expect(out.installmentsCount).toBe(0);
    expect(out.parties).toEqual([]);
  });
});
