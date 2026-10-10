import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useApiWarmup } from "@/hooks/use-api-warmup";

afterEach(() => vi.unstubAllGlobals());

describe("useApiWarmup", () => {
  it("pings the API once on mount, bypassing the HTTP cache", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = renderHook(() => useApiWarmup());
    rerender();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/ping", { cache: "no-store" });
  });

  it("never surfaces a failed ping", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    expect(() => renderHook(() => useApiWarmup())).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
