import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  contractEventsQueryOptions,
  contractQueryOptions,
  useDeleteContractMutation,
  useLeaveContractMutation,
  useUpdateContractMutation,
} from "@/features/contracts/api";
import type { ContractDetail } from "@/features/contracts/types";
import { installmentQueryOptions } from "@/features/installments/api";
import { makeQueryClient } from "@/lib/query";
import { queryKeys } from "@/lib/query-keys";
import { motoDetail } from "./contract-fixtures";
import { makeTestQueryClient } from "./test-utils";

const { patch, contractGet, eventsGet, installmentGet } = vi.hoisted(() => ({
  patch: vi.fn(),
  contractGet: vi.fn(),
  eventsGet: vi.fn(),
  installmentGet: vi.fn(),
}));

vi.mock("@/lib/api", () => {
  const contracts = (_p: { id: string }) => ({
    get: () => contractGet(),
    events: { get: () => eventsGet() },
    delete: () => Promise.resolve({ data: { ok: true }, error: null }),
    patch: (body: unknown) => patch(body),
    me: {
      delete: () => Promise.resolve({ data: { ok: true }, error: null }),
    },
  });
  const installments = (_p: { installmentId: string }) => ({
    get: () => installmentGet(),
  });
  return { api: { api: { contracts, installments } } };
});

const NOT_FOUND = {
  data: null,
  error: {
    status: 404,
    value: { error: { code: "NOT_FOUND", message: "Contrato não encontrado" } },
  },
};

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
    client.setQueryData(queryKeys.contract("c1"), motoDetail());
    await result.current.mutateAsync("c1");
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["home"] })
    );
    expect(client.getQueryData(queryKeys.contract("c1"))).toBeUndefined();
  });

  it("leaveContract invalidates the home", async () => {
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useLeaveContractMutation("c1"), {
      wrapper: wrap(client),
    });
    client.setQueryData(queryKeys.contract("c1"), motoDetail());
    await result.current.mutateAsync();
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["home"] })
    );
    expect(client.getQueryData(queryKeys.contract("c1"))).toBeUndefined();
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

  // A deep link to a deleted contract (decision 20), with the app's own
  // retry policy: the SSR answers the 404 page itself, with a single request.
  it("contractQueryOptions: um 404 é a resposta null, com um só pedido e sem erro", async () => {
    contractGet.mockReset().mockResolvedValue(NOT_FOUND);
    const client = makeQueryClient();
    await expect(
      client.fetchQuery(contractQueryOptions("gone"))
    ).resolves.toBeNull();
    expect(contractGet).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(queryKeys.contract("gone"))?.status).toBe(
      "success"
    );
  });

  // An old notification's ?installment= (the panel, Task 9, says "not found").
  it("installmentQueryOptions: um 404 é a resposta null, com um só pedido e sem erro", async () => {
    installmentGet.mockReset().mockResolvedValue(NOT_FOUND);
    const client = makeQueryClient();
    await expect(
      client.fetchQuery(installmentQueryOptions("gone"))
    ).resolves.toBeNull();
    expect(installmentGet).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(queryKeys.installment("gone"))?.status).toBe(
      "success"
    );
  });

  // The presigned URLs of the proofs last 5 min: a panel left open renews them.
  it("installmentQueryOptions: com comprovante refaz o pedido antes de a URL expirar; sem ele, não", () => {
    const interval = installmentQueryOptions("i1").refetchInterval as (q: {
      state: { data: unknown };
    }) => number | false;
    expect(interval({ state: { data: { proofs: [{ id: "p1" }] } } })).toBe(
      240_000
    );
    expect(interval({ state: { data: { proofs: [] } } })).toBe(false);
    expect(interval({ state: { data: null } })).toBe(false);
  });

  // ?tab=history on a deleted contract: the first page is null, and no more pages.
  it("contractEventsQueryOptions: um 404 é a página null, com um só pedido e sem erro", async () => {
    eventsGet.mockReset().mockResolvedValue(NOT_FOUND);
    const client = makeQueryClient();
    const data = await client.fetchInfiniteQuery(
      contractEventsQueryOptions("gone")
    );
    expect(data.pages).toEqual([null]);
    expect(eventsGet).toHaveBeenCalledTimes(1);
    const options = contractEventsQueryOptions("gone");
    expect(options.getNextPageParam(null, [null], null, [null])).toBeNull();
  });
});
