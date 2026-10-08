import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LocaleSwitch } from "@/components/locale-switch";

describe("LocaleSwitch", () => {
  it("os dois idiomas pelo nome nativo, o atual marcado; trocar chama onChange com o outro", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<LocaleSwitch onChange={onChange} value="pt-BR" />);
    const group = screen.getByRole("group", { name: "Idioma" });
    expect(group).toBeVisible();
    expect(
      screen.getByRole("radio", { name: "Português (Brasil)" })
    ).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "English (US)" }));
    expect(onChange).toHaveBeenCalledWith("en-US");
  });
});
