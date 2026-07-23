import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const mutateAsync = vi.fn();
vi.mock("../src/hooks/use-contract-mutations", () => ({
  useUpdateInstallmentMutation: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("../src/hooks/use-payment-mutations", () => ({
  useSubmitProofMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useConfirmPaymentMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDisputePaymentMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMarkPaidMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const baseDetail = {
  id: "i2",
  sequence: 2,
  amountCents: 200_000,
  dueDate: "2026-08-10",
  status: "pending",
  proofs: [],
  events: [],
  pix: null as { copiaECola: string; keyType: string } | null,
};
// Mutable so individual tests can opt into a `pix` payload without leaking it
// into the other cases (see beforeEach reset below).
let detail = { ...baseDetail };
vi.mock("../src/hooks/use-installment", () => ({
  useInstallmentQuery: () => ({ data: detail, isPending: false }),
}));

import { InstallmentDrawer } from "../src/components/installment-drawer";

const EDIT = /editar parcela/i;
const AMOUNT = /valor/i;
const SAVE = /salvar/i;
const UPLOAD = /escolher comprovante/i;
const PIX_HEADING = /pague com pix/i;
const COPY = /copiar/i;

const installment = {
  id: "i2",
  sequence: 2,
  amountCents: 200_000,
  dueDate: "2026-08-10",
  status: "pending",
};
const noop = () => undefined;

describe("InstallmentDrawer", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({ id: "i2" });
    detail = { ...baseDetail };
  });

  it("shows edit button for owner and the upload action (buyer/owner, pending)", () => {
    renderWithProviders(
      <InstallmentDrawer
        capabilities={{ isPayer: true, isApprover: true }}
        contractId="c1"
        installment={installment}
        isOwner
        onClose={noop}
        open
        requiresConfirmation
      />
    );
    expect(screen.getByRole("button", { name: EDIT })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: UPLOAD })).toBeInTheDocument();
    // detail.pix is null by default: no PIX block should render.
    expect(screen.queryByText(PIX_HEADING)).not.toBeInTheDocument();
  });

  it("hides edit + actions for a viewer", () => {
    renderWithProviders(
      <InstallmentDrawer
        capabilities={{ isPayer: false, isApprover: false }}
        contractId="c1"
        installment={installment}
        isOwner={false}
        onClose={noop}
        open
        requiresConfirmation
      />
    );
    expect(
      screen.queryByRole("button", { name: EDIT })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: UPLOAD })
    ).not.toBeInTheDocument();
  });

  it("owner edits the amount and saves (calls the mutation)", async () => {
    renderWithProviders(
      <InstallmentDrawer
        capabilities={{ isPayer: true, isApprover: true }}
        contractId="c1"
        installment={installment}
        isOwner
        onClose={noop}
        open
        requiresConfirmation
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

  it("mostra o bloco PIX quando detail.pix vem preenchido", () => {
    detail = {
      ...baseDetail,
      pix: { copiaECola: "000201...6304ABCD", keyType: "email" },
    };
    renderWithProviders(
      <InstallmentDrawer
        capabilities={{ isPayer: true, isApprover: false }}
        contractId="c1"
        installment={installment}
        isOwner
        onClose={noop}
        open
        requiresConfirmation={false}
      />
    );
    expect(screen.getByText(PIX_HEADING)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: COPY })).toBeInTheDocument();
  });
});
