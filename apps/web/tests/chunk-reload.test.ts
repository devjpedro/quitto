import { expect, test, vi } from "vitest";
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-reload";

function fakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

test("detecta erro de import dinâmico", () => {
  expect(
    isChunkLoadError(new Error("Failed to fetch dynamically imported module"))
  ).toBe(true);
  expect(isChunkLoadError(new Error("qualquer outro erro"))).toBe(false);
});

test("recarrega só uma vez (guarda em storage)", () => {
  const storage = fakeStorage();
  const reload = vi.fn();
  const e = new Error("Failed to fetch dynamically imported module");
  expect(reloadOnceForChunkError(e, storage, reload)).toBe(true);
  expect(reload).toHaveBeenCalledTimes(1);
  // segunda vez não recarrega (evita loop)
  expect(reloadOnceForChunkError(e, storage, reload)).toBe(false);
  expect(reload).toHaveBeenCalledTimes(1);
});

test("erro não-chunk não recarrega", () => {
  const storage = fakeStorage();
  const reload = vi.fn();
  expect(reloadOnceForChunkError(new Error("boom"), storage, reload)).toBe(
    false
  );
  expect(reload).not.toHaveBeenCalled();
});
