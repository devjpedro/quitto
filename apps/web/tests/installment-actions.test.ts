import { describe, expect, it } from "vitest";
import { availableActions } from "../src/lib/installment-actions";

const payer = { isPayer: true, isApprover: false };
const approver = { isPayer: false, isApprover: true };
const both = { isPayer: true, isApprover: true };
const none = { isPayer: false, isApprover: false };

describe("availableActions — com confirmação", () => {
  it("pagador envia comprovante em pending", () => {
    const a = availableActions(payer, true, "pending");
    expect(a.canUpload).toBe(true);
    expect(a.canConfirm).toBe(false);
    expect(a.canMarkPaid).toBe(false);
  });

  it("aprovador confirma/contesta em awaiting_confirmation", () => {
    const a = availableActions(approver, true, "awaiting_confirmation");
    expect(a.canConfirm).toBe(true);
    expect(a.canDispute).toBe(true);
    expect(a.canUpload).toBe(false);
  });

  it("pagador reenvia comprovante em disputed", () => {
    expect(availableActions(payer, true, "disputed").canUpload).toBe(true);
  });

  it("nenhuma ação em confirmed", () => {
    expect(availableActions(both, true, "confirmed")).toEqual({
      canUpload: false,
      canMarkPaid: false,
      canConfirm: false,
      canDispute: false,
    });
  });

  it("aprovador não envia comprovante; pagador não confirma", () => {
    expect(availableActions(approver, true, "pending").canUpload).toBe(false);
    expect(
      availableActions(payer, true, "awaiting_confirmation").canConfirm
    ).toBe(false);
  });
});

describe("availableActions — sem confirmação", () => {
  it("pagador pode enviar comprovante OU marcar paga em pending", () => {
    const a = availableActions(payer, false, "pending");
    expect(a.canUpload).toBe(true);
    expect(a.canMarkPaid).toBe(true);
    expect(a.canConfirm).toBe(false);
  });

  it("mark-paid só faz sentido sem confirmação", () => {
    expect(availableActions(payer, true, "pending").canMarkPaid).toBe(false);
  });
});

describe("availableActions — dois lados e sem capacidade", () => {
  it("quem tem os dois lados (solo) envia e confirma", () => {
    expect(availableActions(both, true, "pending").canUpload).toBe(true);
    expect(
      availableActions(both, true, "awaiting_confirmation").canConfirm
    ).toBe(true);
  });

  it("sem capacidade (viewer) nunca tem ações", () => {
    expect(availableActions(none, true, "awaiting_confirmation")).toEqual({
      canUpload: false,
      canMarkPaid: false,
      canConfirm: false,
      canDispute: false,
    });
  });
});
