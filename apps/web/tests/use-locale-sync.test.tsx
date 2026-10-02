import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { patch, setLocale } = vi.hoisted(() => ({
  patch: vi.fn(),
  setLocale: vi.fn(),
}));

// The hook must never save a language on its own: the API is mocked only to
// prove that no PATCH goes out.
vi.mock("@/lib/api", () => ({ api: { api: { me: { patch } } } }));
// Keep the real runtime (tests/setup.ts pins getLocale to "pt-BR"); only spy on
// setLocale. getLocale forwards to the live binding so overwriteGetLocale works.
vi.mock("@/paraglide/runtime.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/paraglide/runtime.js")>();
  return { ...actual, getLocale: () => actual.getLocale(), setLocale };
});

import type { Locale } from "@quitto/shared";
import { useLocaleSync } from "@/hooks/use-locale-sync";
import { getLocale, overwriteGetLocale } from "@/paraglide/runtime.js";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  overwriteGetLocale(() => "pt-BR");
});

describe("useLocaleSync", () => {
  it("switches the UI when the account language differs from the cookie", () => {
    renderHook(() => useLocaleSync("en-US"));
    expect(setLocale).toHaveBeenCalledWith("en-US");
    expect(patch).not.toHaveBeenCalled();
  });

  it("does nothing while already in sync", () => {
    renderHook(() => useLocaleSync("pt-BR"));
    expect(setLocale).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it("does nothing while /me has not loaded (undefined)", () => {
    renderHook(() => useLocaleSync(undefined));
    expect(setLocale).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it("does nothing when the account never chose a language (null)", () => {
    const { rerender } = renderHook(
      ({ locale }: { locale: Locale | null | undefined }) =>
        useLocaleSync(locale),
      { initialProps: { locale: undefined as Locale | null | undefined } }
    );
    rerender({ locale: null });
    rerender({ locale: null });
    expect(patch).not.toHaveBeenCalled();
    expect(setLocale).not.toHaveBeenCalled();
  });

  it("leaves an English browser in English when the account never chose (null)", () => {
    overwriteGetLocale(() => "en-US");
    expect(getLocale()).toBe("en-US");
    renderHook(() => useLocaleSync(null));
    // No setLocale means no reload: the browser language stands.
    expect(setLocale).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });
});
