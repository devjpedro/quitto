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

  describe("drag to dismiss", () => {
    // jsdom does not derive pageY from clientY, and motion reads pageY.
    async function dragDown(target: HTMLElement, distance = 200) {
      const at = (y: number) => ({
        clientX: 10,
        clientY: y,
        pageX: 10,
        pageY: y,
      });
      await userEvent.pointer([
        { keys: "[MouseLeft>]", target, coords: at(10) },
        { coords: at(10 + distance / 2) },
        { coords: at(10 + distance) },
        { keys: "[/MouseLeft]" },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    function renderBody(width: number) {
      window.innerWidth = width;
      const onOpenChange = vi.fn();
      render(
        <ResponsiveSheet onOpenChange={onOpenChange} open title="Parcela">
          <p>conteudo</p>
        </ResponsiveSheet>
      );
      return onOpenChange;
    }

    it("dismisses when the header of the bottom sheet is dragged down", async () => {
      const onOpenChange = renderBody(390);
      await dragDown(screen.getByText("Parcela"));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("does not dismiss when the content is dragged", async () => {
      const onOpenChange = renderBody(390);
      await dragDown(screen.getByText("conteudo"));
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("does not dismiss the side panel when its header is dragged", async () => {
      const onOpenChange = renderBody(1024);
      await dragDown(screen.getByText("Parcela"));
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});
