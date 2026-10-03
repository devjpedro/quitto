import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PersonAvatar } from "@/components/ui/person-avatar";

describe("PersonAvatar", () => {
  it("shows the initials on the name's tone, hidden from assistive tech (the name is beside it)", () => {
    const { container } = render(<PersonAvatar name="Marina Pires" />);
    const avatar = container.firstElementChild;
    expect(avatar).toHaveTextContent("MP");
    expect(avatar).toHaveAttribute("aria-hidden", "true");
    expect(avatar).toHaveClass("bg-avatar-clay", "text-on-avatar", "size-6");
  });

  it("28 px on an invite", () => {
    const { container } = render(<PersonAvatar name="Bia Lopes" size="md" />);
    expect(container.firstElementChild).toHaveClass("size-7", "bg-avatar-plum");
  });
});
