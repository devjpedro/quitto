import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { api } from "@/lib/api";
import { warmUpApi } from "@/lib/warm-up";

vi.mock("@/lib/api", () => ({
  api: { api: { ping: { get: vi.fn() } } },
}));

const pingGet = api.api.ping.get as unknown as Mock;

describe("warmUpApi", () => {
  beforeEach(() => {
    pingGet.mockReset();
    pingGet.mockResolvedValue({ data: { status: "ok" }, error: null });
  });

  it("dispara o ping uma vez e retorna void (não-bloqueante)", () => {
    const result = warmUpApi();
    expect(result).toBeUndefined();
    expect(pingGet).toHaveBeenCalledTimes(1);
  });

  it("engole erro do ping sem lançar", () => {
    pingGet.mockRejectedValueOnce(new Error("machine cold"));
    expect(() => warmUpApi()).not.toThrow();
  });
});
