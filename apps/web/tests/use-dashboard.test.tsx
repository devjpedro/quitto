import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestQueryClient } from "./test-utils";

const getDashboard = vi.fn();

vi.mock("@/lib/api", () => ({
  api: { api: { dashboard: { get: () => getDashboard() } } },
}));

import { useDashboardQuery } from "../src/hooks/use-dashboard";

function wrapper(client = makeTestQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useDashboardQuery", () => {
  beforeEach(() => getDashboard.mockReset());

  it("unwraps the summary", async () => {
    getDashboard.mockResolvedValue({
      data: {
        toPayCents: 500,
        toReceiveCents: 0,
        overdueCount: 0,
        overdueCents: 0,
        activeContractsCount: 1,
        completedContractsCount: 0,
        upcoming: [],
      },
      error: null,
    });
    const { result } = renderHook(() => useDashboardQuery(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.toPayCents).toBe(500);
  });
});
