import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ changePassword: vi.fn(), toast: vi.fn() }));
vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("./router-link-stub")).LinkStub,
  useHydrated: () => true,
}));
vi.mock("@/lib/auth-client", () => ({
  changePassword: mocks.changePassword,
  signOut: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toast, error: vi.fn() },
}));

import { renderSettings } from "./settings-fixtures";

afterEach(() => vi.clearAllMocks());

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Trocar a senha" }));
}

describe("Segurança", () => {
  it("senhas diferentes: o erro na confirmação, sem chamar a API", async () => {
    const user = userEvent.setup();
    renderSettings("security");
    await open(user);
    await user.type(screen.getByLabelText("Senha atual"), "atual-123");
    await user.type(screen.getByLabelText("Nova senha"), "nova-senha-1");
    await user.type(screen.getByLabelText("Repita a nova senha"), "outra-2");
    await user.click(
      screen.getByRole("button", { name: "Salvar a nova senha" })
    );
    expect(
      screen.getByLabelText("Repita a nova senha")
    ).toHaveAccessibleDescription("As duas senhas não são iguais.");
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it("senha atual errada: o erro, e os campos ficam", async () => {
    mocks.changePassword.mockResolvedValue({
      data: null,
      error: { code: "INVALID_PASSWORD" },
    });
    const user = userEvent.setup();
    renderSettings("security");
    await open(user);
    await user.type(screen.getByLabelText("Senha atual"), "errada-123");
    await user.type(screen.getByLabelText("Nova senha"), "nova-senha-1");
    await user.type(
      screen.getByLabelText("Repita a nova senha"),
      "nova-senha-1"
    );
    await user.click(
      screen.getByRole("button", { name: "Salvar a nova senha" })
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Senha atual")).toHaveAccessibleDescription(
        "A senha atual não confere."
      )
    );
    expect(screen.getByLabelText("Senha atual")).toHaveValue("errada-123");
    expect(screen.getByLabelText("Nova senha")).toHaveValue("nova-senha-1");
  });

  it("sucesso: os campos limpam e o aviso de senha trocada", async () => {
    mocks.changePassword.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    renderSettings("security");
    await open(user);
    await user.type(screen.getByLabelText("Senha atual"), "atual-123");
    await user.type(screen.getByLabelText("Nova senha"), "nova-senha-1");
    await user.type(
      screen.getByLabelText("Repita a nova senha"),
      "nova-senha-1"
    );
    await user.click(
      screen.getByRole("button", { name: "Salvar a nova senha" })
    );
    await waitFor(() =>
      expect(mocks.changePassword).toHaveBeenCalledWith({
        currentPassword: "atual-123",
        newPassword: "nova-senha-1",
      })
    );
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith("Senha trocada")
    );
    expect(screen.queryByLabelText("Senha atual")).toBeNull();
    await open(user);
    expect(screen.getByLabelText("Senha atual")).toHaveValue("");
  });
});
