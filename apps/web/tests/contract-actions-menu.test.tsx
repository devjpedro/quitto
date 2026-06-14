import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

const deleteAsync = vi.fn().mockResolvedValue({ ok: true });
const leaveAsync = vi.fn().mockResolvedValue({ ok: true });
vi.mock("../src/hooks/use-contract-mutations", () => ({
  useDeleteContractMutation: () => ({
    mutateAsync: deleteAsync,
    isPending: false,
  }),
  useLeaveContractMutation: () => ({
    mutateAsync: leaveAsync,
    isPending: false,
  }),
}));

import { ContractActionsMenu } from "../src/components/contract-actions-menu";

const MENU = /ações do contrato/i;
const DELETE_ITEM = /excluir contrato/i;
const LEAVE_ITEM = /sair do contrato/i;
const DELETE_CONFIRM = /^excluir$/i;
const LEAVE_CONFIRM = /^sair$/i;

describe("ContractActionsMenu", () => {
  beforeEach(() => {
    navigate.mockReset();
    deleteAsync.mockClear();
    leaveAsync.mockClear();
  });

  it("dono exclui o contrato e volta para a lista", async () => {
    renderWithProviders(<ContractActionsMenu contractId="c1" isOwner />);
    await userEvent.click(screen.getByRole("button", { name: MENU }));
    await userEvent.click(screen.getByRole("menuitem", { name: DELETE_ITEM }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: DELETE_CONFIRM })
    );
    await waitFor(() => expect(deleteAsync).toHaveBeenCalledWith("c1"));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: "/contracts" })
    );
    expect(leaveAsync).not.toHaveBeenCalled();
  });

  it("não-dono sai do contrato e volta para a lista", async () => {
    renderWithProviders(
      <ContractActionsMenu contractId="c1" isOwner={false} />
    );
    await userEvent.click(screen.getByRole("button", { name: MENU }));
    await userEvent.click(screen.getByRole("menuitem", { name: LEAVE_ITEM }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: LEAVE_CONFIRM })
    );
    await waitFor(() => expect(leaveAsync).toHaveBeenCalled());
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: "/contracts" })
    );
    expect(deleteAsync).not.toHaveBeenCalled();
  });
});
