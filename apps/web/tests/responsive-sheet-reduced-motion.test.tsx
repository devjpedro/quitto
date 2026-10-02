import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";

// The real hook logs a dev-only "Reduced Motion enabled" hint every time it
// reports true, so the preference is stubbed at the hook instead of the OS.
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => true,
}));

const originalWidth = window.innerWidth;
afterEach(() => {
  window.innerWidth = originalWidth;
});

describe("ResponsiveSheet with reduced motion", () => {
  it("does not slide, in either variant", () => {
    for (const width of [1024, 390]) {
      window.innerWidth = width;
      const { unmount } = render(
        <ResponsiveSheet onOpenChange={vi.fn()} open title="Parcela">
          <p>x</p>
        </ResponsiveSheet>
      );
      const dialog = screen.getByRole("dialog");
      expect(dialog.style.transform).toBe("");
      unmount();
    }
  });

  it("still closes on Escape", async () => {
    const onOpenChange = vi.fn();
    render(
      <ResponsiveSheet onOpenChange={onOpenChange} open title="Parcela">
        <button type="button">ok</button>
      </ResponsiveSheet>
    );
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not dismiss the bottom sheet by dragging its header", async () => {
    window.innerWidth = 390;
    const onOpenChange = vi.fn();
    render(
      <ResponsiveSheet onOpenChange={onOpenChange} open title="Parcela">
        <p>x</p>
      </ResponsiveSheet>
    );
    const at = (y: number) => ({
      clientX: 10,
      clientY: y,
      pageX: 10,
      pageY: y,
    });
    await userEvent.pointer([
      {
        keys: "[MouseLeft>]",
        target: screen.getByText("Parcela"),
        coords: at(10),
      },
      { coords: at(110) },
      { coords: at(210) },
      { keys: "[/MouseLeft]" },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
