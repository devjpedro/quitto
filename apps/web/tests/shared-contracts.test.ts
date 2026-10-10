import { updateInstallmentSchema } from "@quitto/shared";
import { describe, expect, it } from "vitest";

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
