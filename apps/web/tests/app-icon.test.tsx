import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APP_ICON_SURFACE, AppIcon } from "@/components/app-icon";
import { Route as RootRoute } from "@/routes/__root";

const readPublic = (name: string) =>
  readFileSync(resolve(import.meta.dirname, "../public", name), "utf8");

interface HeadTag {
  content?: string;
  media?: string;
  name?: string;
}

const runHead = (
  route: { options: { head?: unknown } },
  loaderData: "light" | "dark" | undefined
) =>
  (
    route.options.head as (ctx: { loaderData: string | undefined }) => {
      meta: HeadTag[];
    }
  )({
    loaderData,
  });

describe("AppIcon", () => {
  it("is the logo's white ring on a Floresta square", () => {
    const { container } = render(<AppIcon />);
    const square = container.querySelector("rect");
    expect(square).toHaveAttribute("fill", APP_ICON_SURFACE);
    expect(APP_ICON_SURFACE).toBe("#1F5A32");
    // DIRECAO › Logo: the corners at 30% of the side (9.6 of 32)...
    expect(square).toHaveAttribute("rx", "9.6");
    // ...and the ring's 24-unit box at 60% of it, centered (19.2 of 32).
    expect(container.querySelector("g")).toHaveAttribute(
      "transform",
      "translate(6.4 6.4) scale(0.8)"
    );
    const [track, arc] = container.querySelectorAll("circle");
    expect(track).toHaveAttribute("stroke", "rgb(255 255 255 / 0.3)");
    expect(arc).toHaveAttribute("stroke", "#FFFFFF");
    expect(arc).toHaveAttribute("stroke-dasharray", "40 57");
    expect(arc).toHaveAttribute("stroke-linecap", "round");
    expect(arc).toHaveAttribute("transform", "rotate(125 12 12)");
  });

  it("maskable fills the square edge to edge (the platform rounds it)", () => {
    const { container } = render(<AppIcon maskable />);
    expect(container.querySelector("rect")).toHaveAttribute("rx", "0");
  });

  it("public/favicon.svg is the AppIcon's own markup (apps/web/scripts/app-icons.tsx)", () => {
    const file = readPublic("favicon.svg");
    expect(file.trim()).toBe(renderToStaticMarkup(<AppIcon size={32} />));
  });
});

describe("manifest.webmanifest", () => {
  it("abre em Floresta (#1F5A32): a página assume a cor do tema depois de carregar", () => {
    // Mockup 21, M5: the splash no longer flashes light before the dark theme.
    const manifest = JSON.parse(readPublic("manifest.webmanifest"));
    expect(manifest.theme_color).toBe("#1F5A32");
    expect(manifest.background_color).toBe("#1F5A32");
  });

  it("sem cookie de tema, duas metas theme-color seguem o prefers-color-scheme", () => {
    const metas = runHead(RootRoute, undefined).meta.filter(
      (tag) => tag.name === "theme-color"
    );
    expect(metas.map((tag) => [tag.content, tag.media])).toEqual([
      ["#F1F0EB", "(prefers-color-scheme: light)"],
      ["#1A1B18", "(prefers-color-scheme: dark)"],
    ]);
  });

  it("traz as metas do iOS para o app da tela inicial", () => {
    const names = runHead(RootRoute, "light").meta.map((tag) => tag.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "apple-mobile-web-app-capable",
        "mobile-web-app-capable",
        "apple-mobile-web-app-status-bar-style",
        "apple-mobile-web-app-title",
      ])
    );
  });
});
