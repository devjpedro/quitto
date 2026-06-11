import { createContractSchema, updateInstallmentSchema } from "@quitto/shared";
import { describe, expect, it } from "vitest";

const validAuto = {
  title: "Apê do irmão",
  ownerRole: "buyer" as const,
  requiresConfirmation: true,
  schedule: {
    mode: "auto" as const,
    totalAmountCents: 12_000_000,
    installmentsCount: 60,
    firstDueDate: "2026-07-10",
  },
};

describe("createContractSchema", () => {
  it("accepts a valid auto contract", () => {
    expect(createContractSchema.safeParse(validAuto).success).toBe(true);
  });

  it("accepts a valid custom contract", () => {
    const r = createContractSchema.safeParse({
      title: "Custom",
      ownerRole: "seller",
      requiresConfirmation: false,
      schedule: {
        mode: "custom",
        installments: [
          { amountCents: 5_000_000, dueDate: "2026-07-10" },
          { amountCents: 7_000_000, dueDate: "2026-08-10" },
        ],
      },
    }).success;
    expect(r).toBe(true);
  });

  it("rejects empty title", () => {
    expect(
      createContractSchema.safeParse({ ...validAuto, title: "" }).success
    ).toBe(false);
  });

  it("rejects installmentsCount below 1", () => {
    const r = createContractSchema.safeParse({
      ...validAuto,
      schedule: { ...validAuto.schedule, installmentsCount: 0 },
    }).success;
    expect(r).toBe(false);
  });

  it("rejects a custom schedule with no installments", () => {
    const r = createContractSchema.safeParse({
      title: "X",
      ownerRole: "neutral",
      requiresConfirmation: false,
      schedule: { mode: "custom", installments: [] },
    }).success;
    expect(r).toBe(false);
  });
});

describe("updateInstallmentSchema", () => {
  it("accepts a partial update with only amountCents", () => {
    expect(
      updateInstallmentSchema.safeParse({ amountCents: 99_999 }).success
    ).toBe(true);
  });

  it("accepts only dueDate", () => {
    expect(
      updateInstallmentSchema.safeParse({ dueDate: "2026-09-10" }).success
    ).toBe(true);
  });

  it("rejects amountCents below 1", () => {
    expect(updateInstallmentSchema.safeParse({ amountCents: 0 }).success).toBe(
      false
    );
  });
});
