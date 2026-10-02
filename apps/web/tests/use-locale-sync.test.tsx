import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { patch, setLocale } = vi.hoisted(() => ({
  patch: vi.fn(),
  setLocale: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: { api: { me: { patch } } } }));
// Keep the real runtime (tests/setup.ts pins getLocale to "pt-BR"); only spy on setLocale.
vi.mock("@/paraglide/runtime.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/paraglide/runtime.js")>()),
  setLocale,
}));

import type { Locale } from "@quitto/shared";
import { useLocaleSync } from "@/hooks/use-locale-sync";

beforeEach(() => {
  vi.clearAllMocks();
  patch.mockResolvedValue({ data: { locale: "pt-BR" }, error: null });
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

  it("saves the language the user is seeing when the account never chose one (null)", () => {
    renderHook(() => useLocaleSync(null));
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith({ locale: "pt-BR" });
    expect(setLocale).not.toHaveBeenCalled();
  });

  it("saves only once per mount, even across re-renders", () => {
    const { rerender } = renderHook(
      ({ locale }: { locale: Locale | null | undefined }) =>
        useLocaleSync(locale),
      { initialProps: { locale: null as Locale | null | undefined } }
    );
    rerender({ locale: null });
    rerender({ locale: null });
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it("waits for /me: undefined first, then null saves once", () => {
    const { rerender } = renderHook(
      ({ locale }: { locale: Locale | null | undefined }) =>
        useLocaleSync(locale),
      { initialProps: { locale: undefined as Locale | null | undefined } }
    );
    expect(patch).not.toHaveBeenCalled();
    rerender({ locale: null });
    rerender({ locale: null });
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith({ locale: "pt-BR" });
  });

  it("ignores a failed save silently (HTTP error)", async () => {
    patch.mockResolvedValue({
      data: null,
      error: {
        status: 500,
        value: { error: { code: "INTERNAL", message: "boom" } },
      },
    });
    expect(() => renderHook(() => useLocaleSync(null))).not.toThrow();
    await vi.waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(setLocale).not.toHaveBeenCalled();
  });

  it("ignores a failed save silently (network error)", async () => {
    patch.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(() => renderHook(() => useLocaleSync(null))).not.toThrow();
    await vi.waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(setLocale).not.toHaveBeenCalled();
  });
});
