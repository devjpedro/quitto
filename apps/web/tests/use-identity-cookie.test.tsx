import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearIdentityCookie,
  usePersistIdentityCookie,
} from "@/hooks/use-identity-cookie";
import { parseIdentityCookie } from "@/lib/identity-cookie";
import type { SessionIdentity, SessionUser } from "@/lib/session-resolver";

const maria: SessionUser = {
  id: "u1",
  name: "Maria",
  email: "m@e.com",
  image: null,
  pixKey: "pix-secret",
  emailRemindersOptIn: false,
  createdAt: "2025-09-12T12:00:00.000Z",
  emailRemindersAvailable: false,
  hasPassword: true,
  locale: null,
};

function identityCookieWrites(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.filter(([value]) =>
    String(value).startsWith("quitto_identity=")
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  clearIdentityCookie();
});

describe("usePersistIdentityCookie", () => {
  it("writes nothing while /me has not loaded", () => {
    renderHook(() => usePersistIdentityCookie(undefined));
    expect(parseIdentityCookie(document.cookie)).toBeNull();
  });

  it("stores only the identity of the signed-in user", () => {
    renderHook(() => usePersistIdentityCookie(maria));
    expect(parseIdentityCookie(document.cookie)).toEqual({
      id: "u1",
      name: "Maria",
      email: "m@e.com",
      image: null,
    });
    expect(decodeURIComponent(document.cookie)).not.toContain("pix-secret");
  });

  it("skips the write when the identity did not change", () => {
    const set = vi.spyOn(Document.prototype, "cookie", "set");
    const { rerender } = renderHook(
      ({ me }: { me: SessionIdentity | undefined }) =>
        usePersistIdentityCookie(me),
      { initialProps: { me: maria as SessionIdentity | undefined } }
    );
    // A refetch hands a new object with the same content.
    rerender({ me: { ...maria } });
    rerender({ me: { ...maria } });
    expect(identityCookieWrites(set)).toHaveLength(1);

    rerender({ me: { ...maria, name: "Maria Souza" } });
    expect(identityCookieWrites(set)).toHaveLength(2);
    expect(parseIdentityCookie(document.cookie)?.name).toBe("Maria Souza");
  });
});

describe("clearIdentityCookie", () => {
  it("removes the identity cookie", () => {
    renderHook(() => usePersistIdentityCookie(maria));
    expect(parseIdentityCookie(document.cookie)).not.toBeNull();
    clearIdentityCookie();
    expect(parseIdentityCookie(document.cookie)).toBeNull();
  });
});
