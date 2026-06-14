import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mutate = vi.fn();
vi.mock("@/hooks/use-account", () => ({
  useDeleteAccountMutation: () => ({ mutate, isPending: false }),
}));

import { DeleteAccountDialog } from "../src/components/delete-account-dialog";

const TRIGGER = /excluir conta/i;
const CONFIRM = /excluir definitivamente/i;
const PHRASE_LABEL = /digite/i;

describe("DeleteAccountDialog", () => {
  it("keeps the confirm button disabled until the phrase is typed", async () => {
    render(<DeleteAccountDialog />);
    await userEvent.click(screen.getByRole("button", { name: TRIGGER }));

    const confirm = screen.getByRole("button", { name: CONFIRM });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(PHRASE_LABEL), "EXCLUIR");
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    expect(mutate).toHaveBeenCalled();
  });
});
