import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/lib/api", () => ({
  api: {
    api: {
      invites: () => ({
        accept: {
          post: () =>
            Promise.resolve({
              data: null,
              error: {
                status: 400,
                value: {
                  error: { code: "VALIDATION", message: "Convite expirado" },
                },
              },
            }),
        },
      }),
    },
  },
}));

import { useAcceptInvite } from "@/features/invites/api";
import { queryKeys } from "@/lib/query-keys";
import { makeTestQueryClient } from "./test-utils";

describe("useAcceptInvite", () => {
  it("um erro ao aceitar (expirou entre a carga e o clique) lê o convite de novo", async () => {
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useAcceptInvite("tok"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.invite("tok") });
  });
});
