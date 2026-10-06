import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSessionSSR = vi.fn();
vi.mock("@/lib/ssr-session", () => ({ getSessionSSR: () => getSessionSSR() }));

import { meQueryOptions } from "@/hooks/use-me";
import { queryKeys } from "@/lib/query-keys";
import { seedSession } from "@/lib/session-route";

const identity = {
  id: "u1",
  name: "João Souza",
  email: "j@x.com",
  image: null,
};

describe("seedSession", () => {
  beforeEach(() => getSessionSSR.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it("no cliente: não chama o servidor e devolve client", async () => {
    expect(await seedSession(new QueryClient())).toBe("client");
    expect(getSessionSSR).not.toHaveBeenCalled();
  });

  it("no servidor, com sessão: semeia a identidade e o me, e devolve authed", async () => {
    vi.stubGlobal("document", undefined);
    getSessionSSR.mockResolvedValue({
      status: "authed",
      identity,
      me: { ...identity, locale: null },
    });
    const qc = new QueryClient();
    expect(await seedSession(qc)).toBe("authed");
    expect(qc.getQueryData(queryKeys.session)).toEqual(identity);
    expect(qc.getQueryData(meQueryOptions.queryKey)).toMatchObject(identity);
  });

  it("no servidor, sem sessão: devolve anon e não semeia nada (quem redireciona é a rota)", async () => {
    vi.stubGlobal("document", undefined);
    getSessionSSR.mockResolvedValue({ status: "anon" });
    const qc = new QueryClient();
    expect(await seedSession(qc)).toBe("anon");
    expect(qc.getQueryData(queryKeys.session)).toBeUndefined();
  });
});
