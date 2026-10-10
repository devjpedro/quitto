import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query-keys";
import { makeTestQueryClient } from "./test-utils";

const { success, failure } = vi.hoisted(() => ({
  success: vi.fn(),
  failure: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success, error: failure } }));

vi.mock("@/lib/api", () => {
  const contracts = (_p: { id: string }) => ({
    installments: (_i: { installmentId: string }) => ({
      patch: () => Promise.resolve({ data: { id: "i1" }, error: null }),
    }),
    participants: ({ participantId }: { participantId: string }) => ({
      "pix-key": {
        patch: (body: { pixKey: string | null }) =>
          Promise.resolve({
            data: { id: participantId, pixKey: body.pixKey },
            error: null,
          }),
      },
    }),
  });
  const installments = (_i: { installmentId: string }) => ({
    "receipt-share": {
      post: () =>
        Promise.resolve({
          data: null,
          error: {
            status: 500,
            value: { error: { code: "INTERNAL", message: "falhou" } },
          },
        }),
    },
    dispute: {
      post: () =>
        Promise.resolve({
          data: {
            id: "i1",
            status: "disputed",
            paidAt: null,
            confirmedAt: null,
          },
          error: null,
        }),
    },
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
  useDisputeMutation,
  useSaveContactKeyMutation,
  useShareReceiptMutation,
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

  it("compartilhar o recibo que falha lança e diz a frase própria, uma vez (não a genérica)", async () => {
    failure.mockClear();
    const { result } = renderHook(() => useShareReceiptMutation("i1"), {
      wrapper: wrap(queryClient),
    });
    await expect(result.current.mutateAsync()).rejects.toBeDefined();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(failure).toHaveBeenCalledTimes(1);
    expect(failure).toHaveBeenCalledWith(
      "O link do recibo não foi criado. Tente de novo."
    );
  });

  it("Enviar contestação mostra o toast 'Contestação enviada'", async () => {
    success.mockClear();
    const { result } = renderHook(() => useDisputeMutation("c1"), {
      wrapper: wrap(queryClient),
    });
    await result.current.mutateAsync({
      installmentId: "i1",
      reason: "Veio R$ 240,00.",
    });
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith("Contestação enviada")
    );
  });

  it("guardar a chave do contato invalida todas as parcelas do contrato (as vizinhas que o painel já pré-buscou também) e o contrato, não só a da vez", async () => {
    const client = makeTestQueryClient();
    // Held as on the page (the test client's gcTime 0 would drop them).
    for (const key of [["contract"], ["installment"]]) {
      client.setQueryDefaults(key, { gcTime: Number.POSITIVE_INFINITY });
    }
    client.setQueryData(queryKeys.contract("c1"), {
      installments: [{ id: "a" }, { id: "b" }],
    });
    for (const id of ["a", "b", "outro-contrato"]) {
      client.setQueryData(queryKeys.installment(id), { id });
    }
    const { result } = renderHook(() => useSaveContactKeyMutation("c1", "a"), {
      wrapper: wrap(client),
    });
    await result.current.mutateAsync({
      participantId: "p-beatriz",
      pixKey: "beatriz@exemplo.com",
    });
    const invalidated = (key: readonly unknown[]) =>
      client.getQueryState(key)?.isInvalidated;
    await waitFor(() =>
      expect(invalidated(queryKeys.installment("b"))).toBe(true)
    );
    expect(invalidated(queryKeys.installment("a"))).toBe(true);
    expect(invalidated(queryKeys.contract("c1"))).toBe(true);
    // A key outside the contract is left alone (the targeted keys of query-keys).
    expect(invalidated(queryKeys.installment("outro-contrato"))).toBe(false);
  });
});
