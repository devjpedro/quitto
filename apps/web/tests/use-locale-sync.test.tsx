import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setLocale = vi.fn();
vi.mock("@/paraglide/runtime.js", () => ({
  getLocale: () => "pt-BR",
  setLocale: (l: string) => setLocale(l),
}));

import { useLocaleSync } from "@/hooks/use-locale-sync";

afterEach(() => setLocale.mockReset());

describe("useLocaleSync", () => {
  it("switches the UI when the account language differs from the cookie", () => {
    renderHook(() => useLocaleSync("en-US"));
    expect(setLocale).toHaveBeenCalledWith("en-US");
  });

  it("does nothing while unknown or already in sync", () => {
    renderHook(() => useLocaleSync(undefined));
    renderHook(() => useLocaleSync("pt-BR"));
    expect(setLocale).not.toHaveBeenCalled();
  });
});
