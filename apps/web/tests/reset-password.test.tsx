import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { resetPassword } = vi.hoisted(() => ({
  resetPassword: vi.fn(() => Promise.resolve({ data: {}, error: null })),
}));
vi.mock("@/lib/auth-client", () => ({ resetPassword }));
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({ token: "tok-123" }),
}));

import { ResetPasswordPage } from "../src/routes/reset-password";

const BTN_REDEFINIR = /redefinir/i;

describe("reset password", () => {
  it("envia a nova senha com o token da URL", async () => {
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText("Nova senha"), "newpass123");
    await userEvent.click(screen.getByRole("button", { name: BTN_REDEFINIR }));
    expect(resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({ newPassword: "newpass123", token: "tok-123" })
    );
  });
});
