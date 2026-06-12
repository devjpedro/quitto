import { describe, expect, it } from "vitest";
import { availableActions } from "../src/lib/installment-actions";

describe("availableActions — com confirmação", () => {
  it("buyer envia comprovante em pending", () => {
    const a = availableActions("buyer", true, "pending");
    expect(a.canUpload).toBe(true);
    expect(a.canConfirm).toBe(false);
    expect(a.canMarkPaid).toBe(false);
  });

  it("seller confirma/contesta em awaiting_confirmation", () => {
    const a = availableActions("seller", true, "awaiting_confirmation");
    expect(a.canConfirm).toBe(true);
    expect(a.canDispute).toBe(true);
    expect(a.canUpload).toBe(false);
  });

  it("buyer reenvia comprovante em disputed", () => {
    expect(availableActions("buyer", true, "disputed").canUpload).toBe(true);
  });

  it("nenhuma ação em confirmed", () => {
    const a = availableActions("owner", true, "confirmed");
    expect(a).toEqual({
      canUpload: false,
      canMarkPaid: false,
      canConfirm: false,
      canDispute: false,
    });
  });

  it("seller não envia comprovante; buyer não confirma", () => {
    expect(availableActions("seller", true, "pending").canUpload).toBe(false);
    expect(
      availableActions("buyer", true, "awaiting_confirmation").canConfirm
    ).toBe(false);
  });
});

describe("availableActions — sem confirmação", () => {
  it("buyer/owner pode enviar comprovante OU marcar paga em pending", () => {
    const a = availableActions("buyer", false, "pending");
    expect(a.canUpload).toBe(true);
    expect(a.canMarkPaid).toBe(true);
    expect(a.canConfirm).toBe(false);
  });

  it("nenhuma ação em paid", () => {
    expect(availableActions("owner", false, "paid")).toEqual({
      canUpload: false,
      canMarkPaid: false,
      canConfirm: false,
      canDispute: false,
    });
  });

  it("mark-paid só faz sentido sem confirmação", () => {
    expect(availableActions("owner", true, "pending").canMarkPaid).toBe(false);
  });
});

describe("availableActions — owner dos dois lados e viewer sem ações", () => {
  it("owner envia e confirma", () => {
    expect(availableActions("owner", true, "pending").canUpload).toBe(true);
    expect(
      availableActions("owner", true, "awaiting_confirmation").canConfirm
    ).toBe(true);
  });

  it("viewer nunca tem ações", () => {
    expect(availableActions("viewer", true, "pending")).toEqual({
      canUpload: false,
      canMarkPaid: false,
      canConfirm: false,
      canDispute: false,
    });
    expect(
      availableActions("viewer", true, "awaiting_confirmation").canConfirm
    ).toBe(false);
  });
});
