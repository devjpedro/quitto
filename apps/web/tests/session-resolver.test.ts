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
  createdAt: "2025-09-12T12:00:00.000Z",
  emailRemindersAvailable: false,
  hasPassword: true,
  locale: "pt-BR",
};

const deps = (over: Partial<Parameters<typeof resolveSessionSSR>[0]> = {}) => ({
  hasSessionCookie: true,
  readIdentityHint: vi.fn(async () => null),
  fetchMe: vi.fn(async () => Response.json(meBody)),
  timeoutMs: 50,
  ...over,
});

describe("resolveSessionSSR", () => {
  it("sem cookie de sessão é anônimo e não toca a rede (cookies de tema/idioma não contam)", async () => {
    const d = deps({ hasSessionCookie: false });
    expect(await resolveSessionSSR(d)).toEqual({ status: "anon" });
    expect(d.readIdentityHint).not.toHaveBeenCalled();
    expect(d.fetchMe).not.toHaveBeenCalled();
  });

  it("cookie de identidade válido: autenticado sem chamar a API", async () => {
    const d = deps({ readIdentityHint: vi.fn(async () => identity) });
    expect(await resolveSessionSSR(d)).toEqual({
      status: "authed",
      identity,
      me: null,
    });
    expect(d.fetchMe).not.toHaveBeenCalled();
  });

  it("sem identidade: 200 do /api/me autentica com o payload completo", async () => {
    const result = await resolveSessionSSR(deps());
    expect(result).toEqual({ status: "authed", identity, me: meBody });
  });

  it("sem identidade: 401 é anônimo", async () => {
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

  it("falha ao ler a identidade não derruba: cai pro /api/me", async () => {
    const d = deps({
      readIdentityHint: vi.fn(() => Promise.reject(new Error("bad cookie"))),
    });
    expect((await resolveSessionSSR(d)).status).toBe("authed");
  });

  it("aborta a ida ao /api/me quando estoura o tempo", async () => {
    let received: AbortSignal | undefined;
    const d = deps({
      fetchMe: vi.fn((signal: AbortSignal) => {
        received = signal;
        return new Promise<Response>(() => undefined);
      }),
    });
    expect(await resolveSessionSSR(d)).toEqual({ status: "unknown" });
    expect(received?.aborted).toBe(true);
  });

  it("limpa o timer quando o /api/me responde antes", async () => {
    vi.useFakeTimers();
    try {
      expect((await resolveSessionSSR(deps())).status).toBe("authed");
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
