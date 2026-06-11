import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const mutateAsync = vi.fn();
vi.mock("../src/hooks/use-contract-mutations", () => ({
  useUpdateInstallmentMutation: () => ({ mutateAsync, isPending: false }),
}));

import { InstallmentDrawer } from "../src/components/installment-drawer";

const EDIT = /editar parcela/i;
const AMOUNT = /valor/i;
const SAVE = /salvar/i;
const TITLE = /parcela 2/i;

const noop = () => undefined;

const installment = {
  id: "i2",
  sequence: 2,
  amountCents: 200_000,
  dueDate: "2026-08-10",
  status: "pending",
};

describe("InstallmentDrawer", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({ id: "i2" });
  });

  it("shows read-only detail and an edit button for the owner", () => {
    renderWithProviders(
      // biome-ignore lint/a11y/useValidAriaRole: `role` is a domain prop of InstallmentDrawer (owner/viewer), not an ARIA role
      <InstallmentDrawer
        contractId="c1"
        installment={installment}
        onClose={noop}
        open
        role="owner"
      />
    );
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: EDIT })).toBeInTheDocument();
  });

  it("hides the edit button for a non-owner", () => {
    renderWithProviders(
      // biome-ignore lint/a11y/useValidAriaRole: `role` is a domain prop of InstallmentDrawer (owner/viewer), not an ARIA role
      <InstallmentDrawer
        contractId="c1"
        installment={installment}
        onClose={noop}
        open
        role="viewer"
      />
    );
    expect(
      screen.queryByRole("button", { name: EDIT })
    ).not.toBeInTheDocument();
  });

  it("owner edits the amount and saves (calls the mutation)", async () => {
    renderWithProviders(
      // biome-ignore lint/a11y/useValidAriaRole: `role` is a domain prop of InstallmentDrawer (owner/viewer), not an ARIA role
      <InstallmentDrawer
        contractId="c1"
        installment={installment}
        onClose={noop}
        open
        role="owner"
      />
    );
    await userEvent.click(screen.getByRole("button", { name: EDIT }));
    const amount = screen.getByLabelText(AMOUNT);
    await userEvent.clear(amount);
    await userEvent.type(amount, "99999");
    await userEvent.click(screen.getByRole("button", { name: SAVE }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(mutateAsync).toHaveBeenCalledWith({
      installmentId: "i2",
      body: { amountCents: 99_999 },
    });
  });
});
