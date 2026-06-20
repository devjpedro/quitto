import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { changePassword } = vi.hoisted(() => ({
  changePassword: vi.fn(() => Promise.resolve({ data: {}, error: null })),
}));
vi.mock("@/lib/auth-client", () => ({ changePassword }));

import { ChangePasswordForm } from "../src/components/change-password-form";

const BTN_TROCAR = /trocar senha/i;
const ERROR_MSG = /senha atual incorreta/i;
const SUCCESS_MSG = /senha alterada/i;

describe("change password form", () => {
  it("chama changePassword com senha atual e nova", async () => {
    render(<ChangePasswordForm />);
    await userEvent.type(screen.getByLabelText("Senha atual"), "oldpass123");
    await userEvent.type(screen.getByLabelText("Nova senha"), "newpass123");
    await userEvent.click(screen.getByRole("button", { name: BTN_TROCAR }));
    expect(changePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPassword: "oldpass123",
        newPassword: "newpass123",
      })
    );
  });

  it("sucesso limpa campos e mostra mensagem de sucesso", async () => {
    render(<ChangePasswordForm />);
    await userEvent.type(screen.getByLabelText("Senha atual"), "oldpass123");
    await userEvent.type(screen.getByLabelText("Nova senha"), "newpass123");
    await userEvent.click(screen.getByRole("button", { name: BTN_TROCAR }));

    expect(screen.getByLabelText("Senha atual")).toHaveValue("");
    expect(screen.getByLabelText("Nova senha")).toHaveValue("");
    await screen.findByText(SUCCESS_MSG);
  });

  it("exibe erro quando changePassword retorna erro", async () => {
    changePassword.mockResolvedValueOnce({
      data: null,
      error: { message: "Senha atual incorreta." },
    } as any);
    render(<ChangePasswordForm />);
    await userEvent.type(screen.getByLabelText("Senha atual"), "wrongpass");
    await userEvent.type(screen.getByLabelText("Nova senha"), "newpass123");
    await userEvent.click(screen.getByRole("button", { name: BTN_TROCAR }));

    expect(screen.getByRole("alert")).toHaveTextContent(ERROR_MSG);
  });
});
