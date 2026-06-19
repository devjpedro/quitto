import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { changePassword } = vi.hoisted(() => ({
  changePassword: vi.fn(() => Promise.resolve({ data: {}, error: null })),
}));
vi.mock("@/lib/auth-client", () => ({ changePassword }));

import { ChangePasswordForm } from "../src/components/change-password-form";

const BTN_TROCAR = /trocar senha/i;

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
});
