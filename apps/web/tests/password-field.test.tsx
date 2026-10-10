import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PasswordField } from "@/components/ui/password-field";

describe("PasswordField", () => {
  it("o olho alterna a visibilidade e o nome acessível", async () => {
    const user = userEvent.setup();
    render(<PasswordField id="password" label="Senha" />);
    const field = screen.getByLabelText("Senha");
    expect(field).toHaveAttribute("type", "password");
    await user.type(field, "segredo123");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(field).toHaveAttribute("type", "text");
    expect(field).toHaveValue("segredo123");
    expect(
      screen.getByRole("button", { name: "Ocultar senha" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("o rótulo, a dica e o erro do TextField continuam", () => {
    render(
      <PasswordField
        error="A senha é curta."
        hint="Pelo menos 8 caracteres."
        id="password"
        label="Senha"
      />
    );
    const field = screen.getByLabelText("Senha");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("A senha é curta.");
  });
});
