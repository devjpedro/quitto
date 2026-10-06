import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  useDeleteContractMutation,
  useLeaveContractMutation,
  useUpdateContractMutation,
} from "@/features/contracts/api";
import type { ContractDetail } from "@/features/contracts/types";
import { queryKeys } from "@/lib/query-keys";
import { motoDetail } from "./contract-fixtures";
import { makeTestQueryClient } from "./test-utils";

const { patch } = vi.hoisted(() => ({ patch: vi.fn() }));

vi.mock("@/lib/api", () => {
  const contracts = (_p: { id: string }) => ({
    delete: () => Promise.resolve({ data: { ok: true }, error: null }),
    patch: (body: unknown) => patch(body),
    me: {
      delete: () => Promise.resolve({ data: { ok: true }, error: null }),
    },
  });
  return { api: { api: { contracts } } };
});

function wrap(client: ReturnType<typeof makeTestQueryClient>) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("contract API (features/contracts/api.ts)", () => {
  it("deleteContract invalidates the home", async () => {
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeleteContractMutation(), {
      wrapper: wrap(client),
    });
    await result.current.mutateAsync("c1");
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["home"] })
    );
  });

  it("leaveContract invalidates the home", async () => {
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useLeaveContractMutation("c1"), {
      wrapper: wrap(client),
    });
    await result.current.mutateAsync();
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["home"] })
    );
  });

  it("updateContract (título) grava no cache do contrato e invalida a home", async () => {
    patch.mockResolvedValue({
      data: {
        id: "c-moto",
        title: "Moto do Rafael",
        description: "CG 160, 2022",
        pixKey: null,
      },
      error: null,
    });
    const client = makeTestQueryClient();
    // Observed, as on the page: gcTime 0 would drop an unwatched entry.
    client.setQueryDefaults(queryKeys.contract("c-moto"), {
      gcTime: Number.POSITIVE_INFINITY,
    });
    client.setQueryData(queryKeys.contract("c-moto"), motoDetail());
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateContractMutation("c-moto"), {
      wrapper: wrap(client),
    });
    await result.current.mutateAsync({
      title: "Moto do Rafael",
      description: "CG 160, 2022",
    });
    expect(patch).toHaveBeenCalledWith({
      title: "Moto do Rafael",
      description: "CG 160, 2022",
    });
    const cached = client.getQueryData<ContractDetail>(
      queryKeys.contract("c-moto")
    );
    expect(cached?.contract.title).toBe("Moto do Rafael");
    expect(cached?.contract.description).toBe("CG 160, 2022");
    // The rest of the contract stays as it was.
    expect(cached?.installments).toHaveLength(10);
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["home"] })
    );
  });
});
