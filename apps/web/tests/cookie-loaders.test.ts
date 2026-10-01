import { afterEach, describe, expect, it, vi } from "vitest";

// Server functions viram request HTTP no cliente: o loader não pode chamá-las.
const { themeSSR, sidebarSSR } = vi.hoisted(() => ({
  themeSSR: vi.fn(),
  sidebarSSR: vi.fn(),
}));
vi.mock("@/lib/theme-ssr", () => ({ getThemeSSR: themeSSR }));
vi.mock("@/lib/sidebar-ssr", () => ({ getSidebarSSR: sidebarSSR }));

import { Route as RootRoute } from "../src/routes/__root";
import { Route as AppRoute } from "../src/routes/_app";

function setCookie(value: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: jsdom test setup, simulando o cookie do browser
  document.cookie = `${value}; path=/`;
}

function clearCookies() {
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0]?.trim();
    if (name) {
      setCookie(`${name}=; max-age=0`);
    }
  }
}

const runLoader = (route: { options: { loader?: unknown } }) =>
  (route.options.loader as () => unknown)();

describe("loaders de cookie no cliente", () => {
  afterEach(clearCookies);

  it("root lê o tema do document.cookie sem server function", async () => {
    setCookie("theme=dark");
    expect(await runLoader(RootRoute)).toBe("dark");
    expect(themeSSR).not.toHaveBeenCalled();
  });

  it("_app lê a sidebar do document.cookie sem server function", async () => {
    setCookie("sidebar=collapsed");
    expect(await runLoader(AppRoute)).toBe("collapsed");
    expect(sidebarSSR).not.toHaveBeenCalled();
  });
});
