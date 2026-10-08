import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hydrated: true,
  resetPassword: vi.fn(),
  search: { token: "tok-123" } as { error?: string; token?: string },
}));
vi.mock("@/lib/auth-client", () => ({ resetPassword: mocks.resetPassword }));
vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("./router-link-stub")).LinkStub,
  useHydrated: () => mocks.hydrated,
  useSearch: () => mocks.search,
}));

import { ResetPasswordPage } from "../src/features/auth/components/reset-password-page";

afterEach(() => {
  mocks.search = { token: "tok-123" };
  mocks.hydrated = true;
  vi.clearAllMocks();
});

async function submit(password = "newpass123") {
  await userEvent.type(screen.getByLabelText("Nova senha"), password);
  await userEvent.click(
    screen.getByRole("button", { name: "Salvar a nova senha" })
  );
}

describe("reset password", () => {
  it("antes de hidratar o botão fica desabilitado e o form é POST (um envio nativo perderia o token)", () => {
    mocks.hydrated = false;
    render(<ResetPasswordPage />);
    const button = screen.getByRole("button", { name: "Salvar a nova senha" });
    expect(button).toBeDisabled();
    expect(button.closest("form")).toHaveAttribute("method", "post");
  });

  it("manda a nova senha com o token da URL", async () => {
    mocks.resetPassword.mockResolvedValue({ data: {}, error: null });
    render(<ResetPasswordPage />);
    await submit();
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      newPassword: "newpass123",
      token: "tok-123",
    });
  });

  it("?error=INVALID_TOKEN ou sem token: Este link não vale mais e Pedir outro link", () => {
    mocks.search = { error: "INVALID_TOKEN" };
    const { unmount } = render(<ResetPasswordPage />);
    expect(
      screen.getByRole("heading", { name: "Este link não vale mais" })
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Pedir outro link" })
    ).toHaveAttribute("href", "/forgot-password");
    unmount();
    mocks.search = {};
    render(<ResetPasswordPage />);
    expect(
      screen.getByRole("heading", { name: "Este link não vale mais" })
    ).toBeVisible();
  });

  it("INVALID_TOKEN na resposta: o mesmo estado", async () => {
    mocks.resetPassword.mockResolvedValue({
      data: null,
      error: { code: "INVALID_TOKEN" },
    });
    render(<ResetPasswordPage />);
    await submit();
    expect(
      await screen.findByRole("heading", { name: "Este link não vale mais" })
    ).toBeVisible();
  });

  it("senha curta: o erro no campo", async () => {
    mocks.resetPassword.mockResolvedValue({
      data: null,
      error: { code: "PASSWORD_TOO_SHORT" },
    });
    render(<ResetPasswordPage />);
    await submit("curta");
    const field = screen.getByLabelText("Nova senha");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(
      "A senha precisa de pelo menos 8 caracteres."
    );
  });

  it("feito: Senha trocada e Entrar", async () => {
    mocks.resetPassword.mockResolvedValue({ data: {}, error: null });
    render(<ResetPasswordPage />);
    await submit();
    expect(
      await screen.findByRole("heading", { name: "Senha trocada" })
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});
