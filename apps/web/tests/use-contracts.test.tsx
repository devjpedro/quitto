import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestQueryClient } from "./test-utils";

const getContracts = vi.fn();
const postContract = vi.fn();
const patchInstallment = vi.fn();

// Mock mirrors the real Eden treaty shape: `contracts` is callable (path param)
// AND carries `.get`/`.post` as properties. Calling it returns the nested
// `({id}).get()` / `.installments({installmentId}).patch()` chain.
vi.mock("@/lib/api", () => {
  const contracts = Object.assign(
    () => ({
      get: vi.fn(),
      installments: () => ({
        patch: (body: unknown) => patchInstallment(body),
      }),
    }),
    {
      get: () => getContracts(),
      post: (body: unknown) => postContract(body),
    }
  );
  return { api: { api: { contracts } } };
});

import {
  useCreateContractMutation,
  useUpdateInstallmentMutation,
} from "../src/hooks/use-contract-mutations";
import { useContractsQuery } from "../src/hooks/use-contracts";

function wrapper(client = makeTestQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useContractsQuery", () => {
  beforeEach(() => {
    getContracts.mockReset();
    postContract.mockReset();
  });

  it("returns the unwrapped list on success", async () => {
    getContracts.mockResolvedValue({
      data: [
        {
          id: "c1",
          title: "T",
          ownerRole: "buyer",
          status: "active",
          totalCents: 1000,
          paidCents: 0,
          percent: 0,
          overdueCount: 0,
          installmentsCount: 1,
        },
      ],
      error: null,
    });
    const { result } = renderHook(() => useContractsQuery(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.title).toBe("T");
  });
});

describe("useCreateContractMutation", () => {
  beforeEach(() => postContract.mockReset());

  it("posts the contract and resolves with the id", async () => {
    postContract.mockResolvedValue({ data: { id: "new-id" }, error: null });
    const { result } = renderHook(() => useCreateContractMutation(), {
      wrapper: wrapper(),
    });
    const created = await result.current.mutateAsync({
      title: "X",
      ownerRole: "buyer",
      requiresConfirmation: false,
      schedule: {
        mode: "auto",
        totalAmountCents: 1000,
        installmentsCount: 1,
        firstDueDate: "2026-07-10",
      },
    });
    expect(created).toEqual({ id: "new-id" });
    expect(postContract).toHaveBeenCalledOnce();
  });
});

describe("useUpdateInstallmentMutation", () => {
  beforeEach(() => patchInstallment.mockReset());

  it("invalidates both the contract detail and the list on success", async () => {
    patchInstallment.mockResolvedValue({ data: { id: "i1" }, error: null });
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUpdateInstallmentMutation("c1"), {
      wrapper: wrapper(client),
    });
    await result.current.mutateAsync({
      installmentId: "i1",
      body: { amountCents: 100 },
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["contract", "c1"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["contracts"] });
  });
});
