import { afterEach, describe, expect, it, vi } from "vitest";

// Server functions viram request HTTP no cliente: o loader não pode chamá-las.
const { themeSSR } = vi.hoisted(() => ({
  themeSSR: vi.fn(),
}));
vi.mock("@/lib/theme-ssr", () => ({ getThemeSSR: themeSSR }));

import { Route as RootRoute } from "../src/routes/__root";

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
});
