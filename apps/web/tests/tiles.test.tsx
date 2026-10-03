import { WarningCircle } from "@phosphor-icons/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DateTile } from "@/components/ui/date-tile";
import { IconTile } from "@/components/ui/icon-tile";

describe("DateTile", () => {
  it("big day and short month, the full date for assistive tech", () => {
    const { container } = render(<DateTile iso="2026-10-13" locale="pt-BR" />);
    expect(container).toHaveTextContent("13");
    expect(container).toHaveTextContent("out");
    expect(screen.getByText("terça-feira, 13 de outubro")).toHaveClass(
      "sr-only"
    );
    expect(container.firstElementChild).toHaveClass(
      "size-11",
      "bg-surface-inset"
    );
  });
});

describe("IconTile", () => {
  it("tinted by tone, decorative", () => {
    const { container } = render(
      <IconTile icon={WarningCircle} tone="danger" />
    );
    const tile = container.firstElementChild;
    expect(tile).toHaveClass("bg-danger-subtle", "text-danger", "size-10");
    expect(tile).toHaveAttribute("aria-hidden", "true");
  });

  it("a group shows its count in the corner; one notification shows none", () => {
    const group = render(
      <IconTile count={24} icon={WarningCircle} tone="danger" />
    );
    expect(group.container).toHaveTextContent("24");
    const single = render(
      <IconTile count={1} icon={WarningCircle} tone="danger" />
    );
    expect(single.container.textContent).toBe("");
    const many = render(
      <IconTile count={240} icon={WarningCircle} tone="danger" />
    );
    expect(many.container).toHaveTextContent("99+");
  });
});
