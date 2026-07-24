import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn().mockResolvedValue({ pixKey: "joao@example.com" });
vi.mock("../src/hooks/use-contract-mutations", () => ({
  useUpdateContractPixKeyMutation: () => ({ mutateAsync, isPending: false }),
}));

import { ContractPixKeyForm } from "../src/components/contract-pix-key-form";

const PROFILE_HINT = /chave do perfil/i;
const CONTRACT_PIX_KEY_LABEL = /chave pix deste contrato/i;
const SAVE_BUTTON = /salvar/i;
const REMOVE_BUTTON = /remover/i;
const INVALID_MESSAGE = /inválida/i;

describe("ContractPixKeyForm", () => {
  beforeEach(() => mutateAsync.mockClear());

  it("mostra o hint quando não há override", () => {
    render(<ContractPixKeyForm contractId="c1" currentPixKey={null} />);
    expect(screen.getByText(PROFILE_HINT)).toBeInTheDocument();
  });

  it("valida chave inválida sem chamar a mutation", async () => {
    render(<ContractPixKeyForm contractId="c1" currentPixKey={null} />);
    await userEvent.type(screen.getByLabelText(CONTRACT_PIX_KEY_LABEL), "xxx");
    await userEvent.click(screen.getByRole("button", { name: SAVE_BUTTON }));
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(INVALID_MESSAGE);
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

  it("remove o override existente", async () => {
    render(
      <ContractPixKeyForm contractId="c1" currentPixKey="joao@example.com" />
    );
    await userEvent.click(screen.getByRole("button", { name: REMOVE_BUTTON }));
    expect(mutateAsync).toHaveBeenCalledWith(null);
    expect(screen.getByLabelText(CONTRACT_PIX_KEY_LABEL)).toHaveValue("");
  });

  it("submits rápidos disparam a mutation só uma vez (trava de reentrada)", async () => {
    let resolveMutation: ((value: unknown) => void) | undefined;
    mutateAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMutation = resolve;
        })
    );
    render(<ContractPixKeyForm contractId="c1" currentPixKey={null} />);
    const input = screen.getByLabelText(CONTRACT_PIX_KEY_LABEL);
    await userEvent.type(input, "joao@example.com");
    const form = input.closest("form");
    if (!form) {
      throw new Error("form não encontrado");
    }
    // Três submits no mesmo tick (auto-repeat do Enter), antes de qualquer
    // re-render/resolução: a trava de reentrada deve barrar do 2º em diante.
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    resolveMutation?.({ pixKey: "joao@example.com" });
    await screen.findByRole("status");
  });
});
