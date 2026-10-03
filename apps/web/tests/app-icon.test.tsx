import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APP_ICON_SURFACE, AppIcon } from "@/components/app-icon";

describe("AppIcon", () => {
  it("is the logo's white ring on a Floresta square", () => {
    const { container } = render(<AppIcon />);
    expect(container.querySelector("rect")).toHaveAttribute(
      "fill",
      APP_ICON_SURFACE
    );
    expect(APP_ICON_SURFACE).toBe("#1F5A32");
    const arc = container.querySelectorAll("circle")[1];
    expect(arc).toHaveAttribute("stroke", "#FFFFFF");
    expect(arc).toHaveAttribute("stroke-dasharray", "40 57");
    expect(arc).toHaveAttribute("transform", "rotate(125 12 12)");
  });

  it("maskable fills the square edge to edge (the platform rounds it)", () => {
    const { container } = render(<AppIcon maskable />);
    expect(container.querySelector("rect")).toHaveAttribute("rx", "0");
  });

  it("public/favicon.svg is the AppIcon's own markup (apps/web/scripts/app-icons.tsx)", () => {
    const file = readFileSync(
      resolve(import.meta.dirname, "../public/favicon.svg"),
      "utf8"
    );
    expect(file.trim()).toBe(renderToStaticMarkup(<AppIcon size={32} />));
  });
});
