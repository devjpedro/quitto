import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChangeLocale } from "@/hooks/use-change-locale";

const { patch, setLocale, toastError } = vi.hoisted(() => ({
  patch: vi.fn(),
  setLocale: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: { api: { me: { patch } } } }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));
// Keep the real runtime (tests/setup.ts overrides getLocale on it); only spy on setLocale.
vi.mock("@/paraglide/runtime.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/paraglide/runtime.js")>()),
  setLocale,
}));

const ERROR_MESSAGE = "Não foi possível mudar o idioma. Tente de novo.";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useChangeLocale", () => {
  it("switches the UI after the account locale is saved", async () => {
    patch.mockResolvedValue({ data: { locale: "en-US" }, error: null });
    const { result } = renderHook(() => useChangeLocale());

    await act(() => result.current("en-US"));

    expect(patch).toHaveBeenCalledWith({ locale: "en-US" });
    expect(setLocale).toHaveBeenCalledWith("en-US");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("keeps the UI language and toasts when the API answers with an HTTP error", async () => {
    patch.mockResolvedValue({
      data: null,
      error: {
        status: 422,
        value: {
          error: { code: "VALIDATION_ERROR", message: "invalid locale" },
        },
      },
    });
    const { result } = renderHook(() => useChangeLocale());

    await act(() => result.current("en-US"));

    expect(setLocale).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(ERROR_MESSAGE);
  });

  it("keeps the UI language and toasts when the request itself fails", async () => {
    patch.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useChangeLocale());

    await act(() => result.current("en-US"));

    expect(setLocale).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(ERROR_MESSAGE);
  });

  it("ignores a second call while the first is still saving", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    patch.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useChangeLocale());

    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current("en-US");
      await result.current("en-US");
    });
    expect(patch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ data: { locale: "en-US" }, error: null });
      await first;
    });
    expect(setLocale).toHaveBeenCalledTimes(1);
  });
});
