import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

const mutateAsync = vi.fn();
vi.mock("../src/hooks/use-contract-mutations", () => ({
  useCreateContractMutation: () => ({ mutateAsync, isPending: false }),
}));

import { ContractNewPage } from "../src/routes/contract-new";

const NEXT = /avançar/i;
const SUBMIT = /criar contrato/i;
const TITLE_ERROR = /informe um título/i;
const TITLE = /título/i;
const TOTAL = /valor total/i;
const COUNT = /n.* de parcelas/i;
const FIRST_DUE = /1.* vencimento/i;

describe("ContractNewPage (wizard)", () => {
  beforeEach(() => {
    navigate.mockReset();
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({ id: "new-id" });
  });

  it("blocks advancing from step 1 when title is empty", async () => {
    renderWithProviders(<ContractNewPage />);
    await userEvent.click(screen.getByRole("button", { name: NEXT }));
    expect(await screen.findByText(TITLE_ERROR)).toBeInTheDocument();
  });

  it("creates a contract (auto) and navigates to its detail", async () => {
    renderWithProviders(<ContractNewPage />);
    await userEvent.type(screen.getByLabelText(TITLE), "Apê do irmão");
    await userEvent.click(screen.getByRole("button", { name: NEXT }));

    await userEvent.type(screen.getByLabelText(TOTAL), "120000");
    await userEvent.type(screen.getByLabelText(COUNT), "60");
    await userEvent.type(screen.getByLabelText(FIRST_DUE), "2026-07-10");
    await userEvent.click(screen.getByRole("button", { name: SUBMIT }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/contracts/$id",
        params: { id: "new-id" },
      })
    );
  });

  it("shows per-field schedule errors and never renders the literal 'undefined' [B3,B4]", async () => {
    renderWithProviders(<ContractNewPage />);
    await userEvent.type(screen.getByLabelText(TITLE), "Apê");
    await userEvent.click(screen.getByRole("button", { name: NEXT }));

    await userEvent.click(screen.getByRole("button", { name: SUBMIT }));

    expect(
      await screen.findByText("Data inválida (use AAAA-MM-DD)")
    ).toBeInTheDocument();
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });
});
