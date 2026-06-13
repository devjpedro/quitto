import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const CONFIRM_TRIGGER = /confirmar pagamento/i;
const CONFIRM_ACTION = /^confirmar$/i;
const DISPUTE_TRIGGER = /contestar/i;
const REASON_LABEL = /motivo/i;
const DISPUTE_SUBMIT = /enviar contestação/i;
const MARK_PAID = /marcar como paga/i;

const confirmFn = vi.fn();
const disputeFn = vi.fn();
const markPaidFn = vi.fn();
vi.mock("../src/hooks/use-payment-mutations", () => ({
  useConfirmPaymentMutation: () => ({
    mutateAsync: confirmFn,
    isPending: false,
  }),
  useDisputePaymentMutation: () => ({
    mutateAsync: disputeFn,
    isPending: false,
  }),
  useMarkPaidMutation: () => ({ mutateAsync: markPaidFn, isPending: false }),
}));

import { PaymentActions } from "../src/components/payment-actions";

const base = { contractId: "c1", installmentId: "i1" };

describe("PaymentActions", () => {
  beforeEach(() => {
    confirmFn.mockReset().mockResolvedValue({ status: "confirmed" });
    disputeFn.mockReset().mockResolvedValue({ status: "disputed" });
    markPaidFn.mockReset().mockResolvedValue({ status: "paid" });
  });

  it("seller confirms via dialog at awaiting_confirmation", async () => {
    renderWithProviders(
      <PaymentActions
        {...base}
        contractRole="seller"
        requiresConfirmation
        status="awaiting_confirmation"
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: CONFIRM_TRIGGER })
    );
    // dialog opens with its own confirm button
    await userEvent.click(screen.getByRole("button", { name: CONFIRM_ACTION }));
    await waitFor(() => expect(confirmFn).toHaveBeenCalledOnce());
  });

  it("seller disputes with an optional reason", async () => {
    renderWithProviders(
      <PaymentActions
        {...base}
        contractRole="seller"
        requiresConfirmation
        status="awaiting_confirmation"
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: DISPUTE_TRIGGER })
    );
    await userEvent.type(
      screen.getByLabelText(REASON_LABEL),
      "Não recebi o valor"
    );
    await userEvent.click(screen.getByRole("button", { name: DISPUTE_SUBMIT }));
    await waitFor(() =>
      expect(disputeFn).toHaveBeenCalledWith("Não recebi o valor")
    );
  });

  it("buyer marks as paid via confirmation dialog in the no-confirmation flow", async () => {
    renderWithProviders(
      <PaymentActions
        {...base}
        contractRole="buyer"
        requiresConfirmation={false}
        status="pending"
      />
    );
    // clicking the trigger button opens the dialog; mutation must NOT fire yet
    await userEvent.click(screen.getByRole("button", { name: MARK_PAID }));
    expect(markPaidFn).not.toHaveBeenCalled();
    // dialog is open — scope to the dialog and click the confirm button inside it
    const dialog = screen.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: MARK_PAID })
    );
    await waitFor(() => expect(markPaidFn).toHaveBeenCalledOnce());
  });

  it("viewer sees no action buttons", () => {
    renderWithProviders(
      <PaymentActions
        {...base}
        contractRole="viewer"
        requiresConfirmation
        status="awaiting_confirmation"
      />
    );
    expect(
      screen.queryByRole("button", { name: CONFIRM_TRIGGER })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: DISPUTE_TRIGGER })
    ).not.toBeInTheDocument();
  });
});
