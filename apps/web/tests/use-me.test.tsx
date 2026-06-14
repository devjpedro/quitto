import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestQueryClient } from "./test-utils";

const getMe = vi.fn();
vi.mock("@/lib/api", () => ({ api: { api: { me: { get: () => getMe() } } } }));

import { useMeQuery } from "../src/hooks/use-me";

function wrapper(client = makeTestQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useMeQuery", () => {
  beforeEach(() => getMe.mockReset());

  it("unwraps the current user", async () => {
    getMe.mockResolvedValue({
      data: { id: "u1", name: "Eu", email: "eu@e.com", image: null },
      error: null,
    });
    const { result } = renderHook(() => useMeQuery(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe("Eu");
  });
});
