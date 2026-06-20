import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { changePassword } = vi.hoisted(() => ({
  changePassword: vi.fn(() => Promise.resolve({ data: {}, error: null })),
}));
vi.mock("@/lib/auth-client", () => ({ changePassword }));

import { ChangePasswordForm } from "../src/components/change-password-form";

const BTN_TROCAR = /trocar senha/i;
const ERROR_MSG = /senha atual incorreta/i;
const SUCCESS_MSG = /senha alterada/i;
const MISMATCH_MSG = /as senhas não coincidem/i;
const SHOW_PASSWORD = /mostrar senha/i;

const CURRENT = "Senha atual";
const NEW = "Nova senha";
const CONFIRM = "Confirmar nova senha";

describe("change password form", () => {
  beforeEach(() => {
    changePassword.mockClear();
  });

  it("chama changePassword com senha atual e nova quando a confirmação confere", async () => {
    render(<ChangePasswordForm />);
    await userEvent.type(screen.getByLabelText(CURRENT), "oldpass123");
    await userEvent.type(screen.getByLabelText(NEW), "newpass123");
    await userEvent.type(screen.getByLabelText(CONFIRM), "newpass123");
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
    await userEvent.type(screen.getByLabelText(CURRENT), "oldpass123");
    await userEvent.type(screen.getByLabelText(NEW), "newpass123");
    await userEvent.type(screen.getByLabelText(CONFIRM), "newpass123");
    await userEvent.click(screen.getByRole("button", { name: BTN_TROCAR }));

    expect(screen.getByLabelText(CURRENT)).toHaveValue("");
    expect(screen.getByLabelText(NEW)).toHaveValue("");
    expect(screen.getByLabelText(CONFIRM)).toHaveValue("");
    await screen.findByText(SUCCESS_MSG);
  });

  it("exibe erro quando changePassword retorna erro", async () => {
    changePassword.mockResolvedValueOnce({
      data: null,
      error: { message: "Senha atual incorreta." },
    } as never);
    render(<ChangePasswordForm />);
    await userEvent.type(screen.getByLabelText(CURRENT), "wrongpass");
    await userEvent.type(screen.getByLabelText(NEW), "newpass123");
    await userEvent.type(screen.getByLabelText(CONFIRM), "newpass123");
    await userEvent.click(screen.getByRole("button", { name: BTN_TROCAR }));

    expect(screen.getByRole("alert")).toHaveTextContent(ERROR_MSG);
  });

  it("bloqueia e avisa quando a confirmação não coincide", async () => {
    render(<ChangePasswordForm />);
    await userEvent.type(screen.getByLabelText(CURRENT), "oldpass123");
    await userEvent.type(screen.getByLabelText(NEW), "newpass123");
    await userEvent.type(screen.getByLabelText(CONFIRM), "outrasenha9");
    await userEvent.click(screen.getByRole("button", { name: BTN_TROCAR }));

    expect(screen.getByRole("alert")).toHaveTextContent(MISMATCH_MSG);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("o olhinho alterna a visibilidade da nova senha", async () => {
    render(<ChangePasswordForm />);
    const newField = screen.getByLabelText(NEW);
    expect(newField).toHaveAttribute("type", "password");

    // o primeiro toggle "Mostrar senha" pertence ao campo Nova senha
    const toggles = screen.getAllByRole("button", { name: SHOW_PASSWORD });
    expect(toggles).toHaveLength(2);
    await userEvent.click(toggles[0] as HTMLElement);

    expect(newField).toHaveAttribute("type", "text");
  });
});
