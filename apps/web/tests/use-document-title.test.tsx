import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDocumentTitle } from "../src/hooks/use-document-title";

describe("useDocumentTitle", () => {
  it("define document.title e restaura ao desmontar", () => {
    const before = document.title;
    const { unmount } = renderHook(() => useDocumentTitle("Quitto · Teste"));
    expect(document.title).toBe("Quitto · Teste");
    unmount();
    expect(document.title).toBe(before);
  });
});
