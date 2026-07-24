import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn().mockResolvedValue({ pixKey: "joao@example.com" });
vi.mock("../src/hooks/use-contract-mutations", () => ({
  useUpdateContractPixKeyMutation: () => ({ mutateAsync, isPending: false }),
}));

import { ContractPixKeyForm } from "../src/components/contract-pix-key-form";

const PROFILE_HINT = /chave do perfil/i;
const CONTRACT_PIX_KEY_LABEL = /chave pix deste contrato/i;
const SAVE_BUTTON = /salvar/i;

describe("ContractPixKeyForm", () => {
  it("mostra o hint quando não há override", () => {
    render(<ContractPixKeyForm contractId="c1" currentPixKey={null} />);
    expect(screen.getByText(PROFILE_HINT)).toBeInTheDocument();
  });

  it("salva override válido", async () => {
    render(<ContractPixKeyForm contractId="c1" currentPixKey={null} />);
    await userEvent.type(
      screen.getByLabelText(CONTRACT_PIX_KEY_LABEL),
      "joao@example.com"
    );
    await userEvent.click(screen.getByRole("button", { name: SAVE_BUTTON }));
    expect(mutateAsync).toHaveBeenCalledWith("joao@example.com");
  });
});
