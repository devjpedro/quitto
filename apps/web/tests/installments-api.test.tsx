import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query-keys";
import { makeTestQueryClient } from "./test-utils";

const { success } = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success, error: vi.fn() } }));

vi.mock("@/lib/api", () => {
  const contracts = (_p: { id: string }) => ({
    installments: (_i: { installmentId: string }) => ({
      patch: () => Promise.resolve({ data: { id: "i1" }, error: null }),
    }),
  });
  const installments = (_i: { installmentId: string }) => ({
    confirm: {
      post: () =>
        Promise.resolve({
          data: {
            id: "i1",
            status: "confirmed",
            paidAt: "2026-10-05T15:00:00.000Z",
            confirmedAt: "2026-10-05T15:00:00.000Z",
          },
          error: null,
        }),
    },
  });
  return { api: { api: { contracts, installments } } };
});

import {
  useConfirmMutation,
  useUpdateInstallmentMutation,
} from "../src/features/installments/api";
import { queryClient } from "../src/lib/query";

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("features/installments/api (revisão I3: os testes do legado contra os hooks novos)", () => {
  afterEach(() => {
    queryClient.getMutationCache().clear();
  });

  it("updateInstallment invalidates the home", async () => {
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
      expect(spy).toHaveBeenCalledWith({ queryKey: ["home"] })
    );
    expect(spy).toHaveBeenCalledWith({
      queryKey: queryKeys.contract("c1"),
    });
    expect(spy).toHaveBeenCalledWith({
      queryKey: queryKeys.installment("i1"),
    });
  });

  it("Confirmar recebimento mostra o toast", async () => {
    success.mockClear();
    // The app's client: its mutation cache turns meta.successMessage into the toast.
    const { result } = renderHook(() => useConfirmMutation("c1"), {
      wrapper: wrap(queryClient),
    });
    await result.current.mutateAsync("i1");
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith("Pagamento confirmado")
    );
  });
});
