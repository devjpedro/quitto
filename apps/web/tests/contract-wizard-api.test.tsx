import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/lib/api", () => ({
  api: {
    api: {
      contracts: {
        post: () =>
          Promise.resolve({
            data: null,
            error: {
              status: 422,
              value: {
                error: {
                  code: "installments.sum.over",
                  message: "installments.sum.over",
                  details: { path: "installments", diff: 100 },
                },
              },
            },
          }),
      },
    },
  },
}));

import { useCreateContract } from "@/features/contract-wizard/api";
import { makeQueryClient } from "@/lib/query";

describe("useCreateContract", () => {
  it("um 422 não faz o toast global: o erro vai para o campo (meta.silentError)", async () => {
    const client = makeQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCreateContract(), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({
          title: "Notebook da Renata",
          ownerRole: "seller",
          requiresConfirmation: false,
          schedule: {
            mode: "split",
            totalAmountCents: 600_000,
            installmentsCount: 12,
            firstDueDate: "2030-12-10",
          },
        })
        .catch(() => undefined);
    });
    expect(toastError).not.toHaveBeenCalled();
  });
});
