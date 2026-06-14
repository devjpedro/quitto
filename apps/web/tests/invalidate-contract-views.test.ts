import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { invalidateContractViews } from "../src/lib/invalidate-contract-views";

function spyQc() {
  return { invalidateQueries: vi.fn() } as unknown as QueryClient;
}

describe("invalidateContractViews", () => {
  it("always invalidates contracts and dashboard", () => {
    const qc = spyQc();
    invalidateContractViews(qc);
    expect(qc.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["contracts"],
    });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["dashboard"],
    });
  });

  it("also invalidates the specific contract when an id is given", () => {
    const qc = spyQc();
    invalidateContractViews(qc, "c1");
    expect(qc.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["contract", "c1"],
    });
  });
});
