import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn().mockResolvedValue({ pixKey: "joao@example.com" });
vi.mock("../src/hooks/use-pix", () => ({
  useUpdatePixKeyMutation: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("../src/hooks/use-me", () => ({
  useMeQuery: () => ({ data: { pixKey: null } }),
}));

import { PixKeyForm } from "../src/components/pix-key-form";

const PIX_KEY_LABEL = /chave pix/i;
const SAVE_BUTTON = /salvar/i;
const INVALID_MESSAGE = /inválida/i;

describe("PixKeyForm", () => {
  it("valida chave inválida sem chamar a mutation", async () => {
    render(<PixKeyForm />);
    await userEvent.type(screen.getByLabelText(PIX_KEY_LABEL), "xxx");
    await userEvent.click(screen.getByRole("button", { name: SAVE_BUTTON }));
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(INVALID_MESSAGE);
  });

  it("salva chave válida", async () => {
    render(<PixKeyForm />);
    await userEvent.type(
      screen.getByLabelText(PIX_KEY_LABEL),
      "joao@example.com"
    );
    await userEvent.click(screen.getByRole("button", { name: SAVE_BUTTON }));
    expect(mutateAsync).toHaveBeenCalledWith("joao@example.com");
  });
});
