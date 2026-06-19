import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { requestPasswordReset } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(() => Promise.resolve({ data: {}, error: null })),
}));
vi.mock("@/lib/auth-client", () => ({ requestPasswordReset }));

import { ForgotPasswordPage } from "../src/routes/forgot-password";

const BTN_ENVIAR = /enviar/i;
const TXT_ENVIAMOS = /enviamos um link/i;

describe("forgot password", () => {
  it("envia o pedido de reset com o e-mail digitado", async () => {
    render(<ForgotPasswordPage />);
    await userEvent.type(screen.getByLabelText("E-mail"), "a@b.com");
    await userEvent.click(screen.getByRole("button", { name: BTN_ENVIAR }));
    expect(requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@b.com" })
    );
  });

  it("mostra confirmação neutra após enviar (não revela se a conta existe)", async () => {
    render(<ForgotPasswordPage />);
    await userEvent.type(screen.getByLabelText("E-mail"), "a@b.com");
    await userEvent.click(screen.getByRole("button", { name: BTN_ENVIAR }));
    expect(await screen.findByText(TXT_ENVIAMOS)).toBeInTheDocument();
  });
});
