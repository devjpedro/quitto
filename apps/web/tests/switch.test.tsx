import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it("role switch com aria-checked; Espaço alterna", async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Switch
        aria-label="Lembretes"
        checked={false}
        onCheckedChange={onCheckedChange}
      />
    );
    const toggle = screen.getByRole("switch", { name: "Lembretes" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.tab();
    expect(toggle).toHaveFocus();
    await user.keyboard(" ");
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
