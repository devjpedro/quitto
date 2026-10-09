import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { hydrated, requestPasswordReset } = vi.hoisted(() => ({
  hydrated: { value: true },
  requestPasswordReset: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({ requestPasswordReset }));
vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("./router-link-stub")).LinkStub,
  useHydrated: () => hydrated.value,
}));

import { ForgotPasswordPage } from "../src/features/auth/components/forgot-password-page";
import { renderWithProviders as render } from "./test-utils";

const SUBMIT = "Mandar o link";

async function submit(email = "a@b.com") {
  await userEvent.type(screen.getByLabelText("E-mail"), email);
  await userEvent.click(screen.getByRole("button", { name: SUBMIT }));
}

describe("forgot password", () => {
  it("antes de hidratar o botão fica desabilitado e o form é POST", () => {
    hydrated.value = false;
    render(<ForgotPasswordPage />);
    const button = screen.getByRole("button", { name: SUBMIT });
    expect(button).toBeDisabled();
    expect(button.closest("form")).toHaveAttribute("method", "post");
    hydrated.value = true;
  });

  it("manda o pedido com o e-mail e o redirectTo /reset-password", async () => {
    requestPasswordReset.mockResolvedValue({ data: {}, error: null });
    render(<ForgotPasswordPage />);
    await submit();
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "a@b.com",
      redirectTo: `${window.location.origin}/reset-password`,
    });
  });

  it("depois de enviar, a vitrine mostra o e-mail de nova senha que vai chegar", async () => {
    requestPasswordReset.mockResolvedValue({ data: {}, error: null });
    const { container } = render(<ForgotPasswordPage />);
    await submit();
    await screen.findByRole("status");
    expect(container).toHaveTextContent(
      "Assunto: Crie uma nova senha no Quitto"
    );
    expect(container).toHaveTextContent("Criar nova senha");
  });

  it("a confirmação é neutra e cita o e-mail digitado", async () => {
    requestPasswordReset.mockResolvedValue({ data: {}, error: null });
    render(<ForgotPasswordPage />);
    await submit("quem@exemplo.com");
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(
      "Se quem@exemplo.com tiver conta, o link chega em alguns minutos e vale por 1 hora."
    );
    expect(
      screen.getByRole("heading", { name: "Confira seu e-mail" })
    ).toBeVisible();
  });

  it("limite de tentativas: a frase de muitas tentativas", async () => {
    requestPasswordReset.mockResolvedValue({
      data: null,
      error: { code: "TOO_MANY_REQUESTS", status: 429 },
    });
    render(<ForgotPasswordPage />);
    await submit();
    expect(
      await screen.findByText(
        "Muitas tentativas seguidas. Espere um pouco e tente de novo."
      )
    ).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("‹ Entrar no topo leva ao login", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});
