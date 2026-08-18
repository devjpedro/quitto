import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCommandPalette } from "../src/hooks/use-command-palette";

function press(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
  act(() => {
    document.dispatchEvent(event);
  });
  return event;
}

describe("useCommandPalette", () => {
  it("começa fechada", () => {
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.open).toBe(false);
  });

  it("⌘K alterna a paleta e cancela o atalho do navegador", () => {
    const { result } = renderHook(() => useCommandPalette());

    const opening = press({ key: "k", metaKey: true });
    expect(result.current.open).toBe(true);
    // Sem preventDefault o Chrome/Firefox rouba o ⌘K pra barra de busca.
    expect(opening.defaultPrevented).toBe(true);

    press({ key: "k", metaKey: true });
    expect(result.current.open).toBe(false);
  });

  it("aceita Ctrl+K e o K maiúsculo (⇧ pressionado)", () => {
    const { result } = renderHook(() => useCommandPalette());
    press({ key: "k", ctrlKey: true });
    expect(result.current.open).toBe(true);
    press({ key: "K", ctrlKey: true });
    expect(result.current.open).toBe(false);
  });

  it("ignora K sem modificador e outros atalhos", () => {
    const { result } = renderHook(() => useCommandPalette());
    press({ key: "k" });
    press({ key: "j", metaKey: true });
    expect(result.current.open).toBe(false);
  });

  it("solta o listener ao desmontar", () => {
    const { result, unmount } = renderHook(() => useCommandPalette());
    unmount();
    const event = press({ key: "k", metaKey: true });
    expect(result.current.open).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });
});
