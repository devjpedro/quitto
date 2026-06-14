import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { makeTestQueryClient } from "./test-utils";

vi.mock("@/lib/api", () => {
  const contracts = (_p: { id: string }) => ({
    delete: () => Promise.resolve({ data: { ok: true }, error: null }),
    me: {
      delete: () => Promise.resolve({ data: { ok: true }, error: null }),
    },
  });
  return { api: { api: { contracts } } };
});

import {
  useDeleteContractMutation,
  useLeaveContractMutation,
} from "../src/hooks/use-contract-mutations";

function wrap(client: ReturnType<typeof makeTestQueryClient>) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("contract lifecycle mutations", () => {
  it("deleteContract invalidates the dashboard", async () => {
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeleteContractMutation(), {
      wrapper: wrap(client),
    });
    await result.current.mutateAsync("c1");
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["dashboard"] })
    );
  });

  it("leaveContract invalidates the dashboard", async () => {
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useLeaveContractMutation("c1"), {
      wrapper: wrap(client),
    });
    await result.current.mutateAsync();
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["dashboard"] })
    );
  });
});
