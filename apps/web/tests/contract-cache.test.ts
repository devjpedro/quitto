import { describe, expect, it } from "vitest";
import { withInstallmentPatch } from "@/features/contracts/lib/contract-cache";
import { motoDetail } from "./contract-fixtures";

describe("withInstallmentPatch", () => {
  it("marca a 3 como confirmada e refaz o progresso: falta R$ 3.360,00, nenhuma atrasada", () => {
    const detail = motoDetail();
    const id = detail.installments[2]?.id as string;
    const next = withInstallmentPatch(
      detail,
      id,
      {
        status: "confirmed",
        paidAt: "2026-10-05T15:00:00Z",
        confirmedAt: "2026-10-05T15:00:00Z",
      },
      "2026-10-05"
    );
    expect(next.installments[2]).toMatchObject({
      status: "confirmed",
      paidAt: "2026-10-05T15:00:00Z",
    });
    expect(next.progress).toEqual({
      totalCents: 480_000,
      paidCents: 144_000,
      remainingCents: 336_000,
      percent: 30,
      overdueCount: 0,
    });
    expect(detail.installments[2]?.status).toBe("pending");
  });
});
