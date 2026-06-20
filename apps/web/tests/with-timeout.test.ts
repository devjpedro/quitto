import { afterEach, describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout } from "@/lib/with-timeout";

afterEach(() => {
  vi.useRealTimers();
});

describe("withTimeout", () => {
  it("resolve com o valor quando a promise responde a tempo", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok");
  });

  it("rejeita com TimeoutError quando estoura o prazo", async () => {
    vi.useFakeTimers();
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally never-resolving promise executor
    const never = new Promise<string>(() => {});
    const pending = withTimeout(never, 1000);
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("propaga a rejeição original quando a promise falha antes do prazo", async () => {
    const boom = Promise.reject(new Error("boom"));
    await expect(withTimeout(boom, 1000)).rejects.toThrow("boom");
  });
});
