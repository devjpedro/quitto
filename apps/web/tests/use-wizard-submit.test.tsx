import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const { navigate, post } = vi.hoisted(() => ({
  navigate: vi.fn(),
  post: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/lib/api", () => ({ api: { api: { contracts: { post } } } }));

import { useWizardSubmit } from "@/features/contract-wizard/hooks/use-wizard-submit";
import { makeTestQueryClient } from "./test-utils";
import { NOTEBOOK } from "./wizard-harness";

describe("useWizardSubmit", () => {
  it("depois do sucesso, outro clique não cria outro contrato, e a volta não reabre o wizard", async () => {
    post.mockResolvedValue({
      data: { id: "c1", invite: null },
      error: null,
    });
    const client = makeTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useWizardSubmit(), { wrapper });
    act(() => result.current.submit(NOTEBOOK, vi.fn()));
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    act(() => result.current.submit(NOTEBOOK, vi.fn()));
    expect(post).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ replace: true })
    );
  });
});
