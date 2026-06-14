import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { makeTestQueryClient } from "./test-utils";

vi.mock("@/lib/api", () => {
  const contracts = Object.assign(
    (_p: { id: string }) => ({
      installments: (_i: { installmentId: string }) => ({
        patch: () => Promise.resolve({ data: { id: "i1" }, error: null }),
      }),
    }),
    { post: () => Promise.resolve({ data: { id: "c1" }, error: null }) }
  );
  return { api: { api: { contracts } } };
});

import {
  useCreateContractMutation,
  useUpdateInstallmentMutation,
} from "../src/hooks/use-contract-mutations";

function wrap(client: ReturnType<typeof makeTestQueryClient>) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("cache coherence", () => {
  it("createContract invalidates the dashboard", async () => {
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateContractMutation(), {
      wrapper: wrap(client),
    });
    await result.current.mutateAsync({
      title: "T",
      ownerRole: "buyer",
      requiresConfirmation: false,
      schedule: {
        mode: "auto",
        totalAmountCents: 1000,
        installmentsCount: 1,
        firstDueDate: "2026-07-10",
      },
    });
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["dashboard"] })
    );
  });

  it("updateInstallment invalidates the dashboard", async () => {
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateInstallmentMutation("c1"), {
      wrapper: wrap(client),
    });
    await result.current.mutateAsync({
      installmentId: "i1",
      body: { amountCents: 500 },
    });
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["dashboard"] })
    );
  });
});
