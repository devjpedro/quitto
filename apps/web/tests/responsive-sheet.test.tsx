import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";

const originalWidth = window.innerWidth;
afterEach(() => {
  window.innerWidth = originalWidth;
});

function renderSheet(onOpenChange = vi.fn()) {
  render(
    <ResponsiveSheet
      description="Vence amanhã"
      onOpenChange={onOpenChange}
      open
      title="Parcela 7 de 12"
    >
      <button type="button">Enviar comprovante</button>
    </ResponsiveSheet>
  );
  return onOpenChange;
}

describe("ResponsiveSheet", () => {
  it("is a named dialog that focuses the content first, not the close button", () => {
    renderSheet();
    expect(
      screen.getByRole("dialog", { name: "Parcela 7 de 12" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Enviar comprovante" })
    ).toHaveFocus();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeVisible();
  });

  it("closes on Escape", async () => {
    const onOpenChange = renderSheet();
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("is a side panel from md up and a bottom sheet below", () => {
    window.innerWidth = 1024;
    const { unmount } = render(
      <ResponsiveSheet onOpenChange={vi.fn()} open title="A">
        <p>x</p>
      </ResponsiveSheet>
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("data-variant", "side");
    unmount();
    window.innerWidth = 390;
    render(
      <ResponsiveSheet onOpenChange={vi.fn()} open title="B">
        <p>x</p>
      </ResponsiveSheet>
    );
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-variant",
      "bottom"
    );
  });

  it("closes from the Close button", async () => {
    const onOpenChange = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays mounted for the exit animation, then unmounts", async () => {
    const sheet = (open: boolean) => (
      <ResponsiveSheet onOpenChange={vi.fn()} open={open} title="Parcela">
        <p>x</p>
      </ResponsiveSheet>
    );
    const { rerender } = render(sheet(true));
    expect(screen.getByRole("dialog")).toBeVisible();
    rerender(sheet(false));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });
});
