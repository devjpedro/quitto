import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useIdentity } from "@/hooks/use-identity";
import { queryKeys } from "@/lib/query-keys";
import { makeTestQueryClient } from "./test-utils";

vi.mock("@/lib/api", () => ({
  api: { api: { me: { get: () => new Promise(() => undefined) } } },
}));

function wrapperWith(client = makeTestQueryClient()) {
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

const seeded = { id: "u1", name: "Maria", email: "m@e.com", image: null };

describe("useIdentity", () => {
  it("returns null while nothing is known", () => {
    const { wrapper } = wrapperWith();
    expect(
      renderHook(() => useIdentity(), { wrapper }).result.current
    ).toBeNull();
  });

  it("uses the SSR-seeded identity before /me resolves", () => {
    const { client, wrapper } = wrapperWith();
    client.setQueryData(queryKeys.session, seeded);
    expect(renderHook(() => useIdentity(), { wrapper }).result.current).toEqual(
      seeded
    );
  });

  it("prefers fresh /me data over the seed", () => {
    const { client, wrapper } = wrapperWith();
    client.setQueryData(queryKeys.session, seeded);
    client.setQueryData(queryKeys.me, {
      ...seeded,
      name: "Maria Souza",
      pixKey: null,
      emailRemindersOptIn: false,
      emailRemindersAvailable: false,
      locale: "pt-BR",
    });
    expect(
      renderHook(() => useIdentity(), { wrapper }).result.current?.name
    ).toBe("Maria Souza");
  });
});
