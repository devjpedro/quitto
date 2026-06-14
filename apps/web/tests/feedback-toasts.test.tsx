import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { success } = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success, error: vi.fn() } }));

vi.mock("@/lib/api", () => {
  const contracts = Object.assign(
    (_p: { id: string }) => ({
      confirm: {
        post: () =>
          Promise.resolve({ data: { status: "confirmed" }, error: null }),
      },
    }),
    { post: () => Promise.resolve({ data: { id: "c1" }, error: null }) }
  );
  const installments = (_i: { installmentId: string }) => ({
    confirm: {
      post: () =>
        Promise.resolve({ data: { status: "confirmed" }, error: null }),
    },
  });
  return { api: { api: { contracts, installments } } };
});

import { useCreateContractMutation } from "../src/hooks/use-contract-mutations";
import { useConfirmPaymentMutation } from "../src/hooks/use-payment-mutations";
import { FEEDBACK } from "../src/lib/feedback";
import { queryClient } from "../src/lib/query";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("feedback toasts wiring", () => {
  afterEach(() => {
    queryClient.getMutationCache().clear();
  });

  it("createContract toasts the success message", async () => {
    success.mockClear();
    const { result } = renderHook(() => useCreateContractMutation(), {
      wrapper,
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
      expect(success).toHaveBeenCalledWith(FEEDBACK.contractCreated)
    );
  });

  it("confirmPayment toasts the success message", async () => {
    success.mockClear();
    const { result } = renderHook(() => useConfirmPaymentMutation("c1", "i1"), {
      wrapper,
    });
    await result.current.mutateAsync();
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(FEEDBACK.paymentConfirmed)
    );
  });
});
