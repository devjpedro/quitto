import { describe, expect, it, vi } from "vitest";

const { success } = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success, error: vi.fn() } }));

import { toastSuccessFromMeta } from "../src/lib/query";

describe("toastSuccessFromMeta", () => {
  it("toasts the meta.successMessage on success", () => {
    success.mockClear();
    toastSuccessFromMeta(null, null, null, {
      meta: { successMessage: "Feito" },
    } as never);
    expect(success).toHaveBeenCalledWith("Feito");
  });

  it("does nothing when there is no successMessage", () => {
    success.mockClear();
    toastSuccessFromMeta(null, null, null, { meta: undefined } as never);
    expect(success).not.toHaveBeenCalled();
  });
});
