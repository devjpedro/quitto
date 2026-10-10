import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteAccount } from "@/features/settings/api";
import { useSignOut } from "@/hooks/use-sign-out";
import {
  parseIdentityCookie,
  serializeIdentityCookie,
} from "@/lib/identity-cookie";
import { makeTestQueryClient } from "./test-utils";

const { signOut, meDelete } = vi.hoisted(() => ({
  signOut: vi.fn(async () => undefined),
  meDelete: vi.fn(async () => ({ data: { ok: true }, error: null })),
}));
vi.mock("@/lib/auth-client", () => ({ signOut }));
vi.mock("@/lib/api", () => ({ api: { api: { me: { delete: meDelete } } } }));

const maria = { id: "u1", name: "Maria", email: "m@e.com", image: null };

/** Records where the hard navigation went and which cookies were left at that moment. */
function stubLocation() {
  const seen: { href?: string; cookie?: string } = {};
  vi.stubGlobal("location", {
    protocol: "http:",
    set href(value: string) {
      seen.href = value;
      seen.cookie = document.cookie;
    },
  });
  return seen;
}

beforeEach(() => {
  vi.clearAllMocks();
  // biome-ignore lint/suspicious/noDocumentCookie: jsdom test setup, the hint written while signed in
  document.cookie = serializeIdentityCookie(maria, { secure: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSignOut", () => {
  it("clears the identity cookie before the hard navigation to /login", async () => {
    const seen = stubLocation();
    const { result } = renderHook(() => useSignOut());
    await act(() => result.current());

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(seen.href).toBe("/login");
    expect(parseIdentityCookie(seen.cookie)).toBeNull();
  });
});

describe("useDeleteAccount", () => {
  it("clears the identity cookie before the hard navigation to /login", async () => {
    const seen = stubLocation();
    const client = makeTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteAccount(), {
      wrapper,
    });
    act(() => result.current.mutate());

    await waitFor(() => expect(seen.href).toBe("/login"));
    expect(meDelete).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(parseIdentityCookie(seen.cookie)).toBeNull();
  });
});
