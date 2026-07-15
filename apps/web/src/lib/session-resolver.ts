/** Timeout do check de sessão no SSR (curto: não segura a resposta no boot frio). */
export const SESSION_SSR_TIMEOUT_MS = 1500;

export type SessionResult =
  | { status: "authed"; user: unknown }
  | { status: "anon" }
  | { status: "unknown" };

/**
 * Decisão pura do check de sessão híbrido (server-side, com timeout).
 * - sem cookie → anon (nem toca a rede)
 * - 200 → authed (com o payload de /api/me)
 * - 401 → anon
 * - timeout ou erro transitório (5xx/exception) → unknown (o cliente reassume)
 */
export async function resolveSessionSSR(opts: {
  cookie: string | null;
  fetchMe: (cookie: string) => Promise<Response>;
  timeoutMs: number;
}): Promise<SessionResult> {
  if (!opts.cookie) {
    return { status: "anon" };
  }
  const timeout = new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), opts.timeoutMs);
  });
  try {
    const res = await Promise.race([opts.fetchMe(opts.cookie), timeout]);
    if (res === "timeout") {
      return { status: "unknown" };
    }
    if (res.status === 200) {
      return { status: "authed", user: await res.json() };
    }
    if (res.status === 401) {
      return { status: "anon" };
    }
    return { status: "unknown" };
  } catch {
    return { status: "unknown" };
  }
}
