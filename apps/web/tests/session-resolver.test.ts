import { describe, expect, it, vi } from "vitest";
import {
  resolveSessionSSR,
  type SessionIdentity,
} from "@/lib/session-resolver";

const identity: SessionIdentity = {
  id: "u1",
  name: "Maria",
  email: "m@e.com",
  image: null,
};
const meBody = {
  ...identity,
  pixKey: null,
  emailRemindersOptIn: false,
  emailRemindersAvailable: false,
  locale: "pt-BR",
};

const deps = (over: Partial<Parameters<typeof resolveSessionSSR>[0]> = {}) => ({
  hasSessionCookie: true,
  readCachedIdentity: vi.fn(async () => null),
  fetchMe: vi.fn(async () => Response.json(meBody)),
  timeoutMs: 50,
  ...over,
});

describe("resolveSessionSSR", () => {
  it("sem cookie de sessão é anônimo e não toca a rede (cookies de tema/idioma não contam)", async () => {
    const d = deps({ hasSessionCookie: false });
    expect(await resolveSessionSSR(d)).toEqual({ status: "anon" });
    expect(d.readCachedIdentity).not.toHaveBeenCalled();
    expect(d.fetchMe).not.toHaveBeenCalled();
  });

  it("cookie cache válido: autenticado sem chamar a API", async () => {
    const d = deps({ readCachedIdentity: vi.fn(async () => identity) });
    expect(await resolveSessionSSR(d)).toEqual({
      status: "authed",
      identity,
      me: null,
    });
    expect(d.fetchMe).not.toHaveBeenCalled();
  });

  it("sem cache: 200 do /api/me autentica com o payload completo", async () => {
    const result = await resolveSessionSSR(deps());
    expect(result).toEqual({ status: "authed", identity, me: meBody });
  });

  it("sem cache: 401 é anônimo", async () => {
    const d = deps({
      fetchMe: vi.fn(async () => new Response(null, { status: 401 })),
    });
    expect(await resolveSessionSSR(d)).toEqual({ status: "anon" });
  });

  it("API fria (timeout) é unknown — o shell renderiza e o cliente decide", async () => {
    const d = deps({
      fetchMe: vi.fn(() => new Promise<Response>(() => undefined)),
    });
    expect(await resolveSessionSSR(d)).toEqual({ status: "unknown" });
  });

  it("5xx ou erro de rede é unknown", async () => {
    expect(
      await resolveSessionSSR(
        deps({
          fetchMe: vi.fn(async () => new Response(null, { status: 503 })),
        })
      )
    ).toEqual({ status: "unknown" });
    expect(
      await resolveSessionSSR(
        deps({
          fetchMe: vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))),
        })
      )
    ).toEqual({ status: "unknown" });
  });

  it("falha ao ler o cache não derruba: cai pro /api/me", async () => {
    const d = deps({
      readCachedIdentity: vi.fn(() =>
        Promise.reject(new Error("bad signature"))
      ),
    });
    expect((await resolveSessionSSR(d)).status).toBe("authed");
  });
});
