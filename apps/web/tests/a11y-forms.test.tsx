import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ useSearch: () => ({}) }));
vi.mock("@/lib/auth-client", () => ({
  signIn: {
    email: () => Promise.resolve({ error: { message: "x" } }),
    social: vi.fn(),
  },
  signUp: { email: vi.fn() },
  sendVerificationEmail: vi.fn(),
}));

import { LoginPage } from "../src/routes/login";

const SUBMIT = /^Entrar$/;

describe("login form a11y", () => {
  it("associa o erro ao campo via aria-describedby + aria-invalid", async () => {
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText("E-mail"), "a@b.com");
    await userEvent.type(screen.getByLabelText("Senha"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: SUBMIT }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("id", "auth-error");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute(
      "aria-describedby",
      "auth-error"
    );
    expect(screen.getByLabelText("E-mail")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });
});
