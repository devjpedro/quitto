import type { Locale } from "@quitto/shared";

/** Timeout of the SSR session check: short, never hold the response on a cold API. */
export const SESSION_SSR_TIMEOUT_MS = 1500;

export interface SessionIdentity {
  email: string;
  id: string;
  image: string | null;
  name: string;
}

export interface SessionUser extends SessionIdentity {
  emailRemindersAvailable: boolean;
  emailRemindersOptIn: boolean;
  locale: Locale;
  pixKey: string | null;
}

export type SessionResult =
  | { status: "authed"; identity: SessionIdentity; me: SessionUser | null }
  | { status: "anon" }
  | { status: "unknown" };

export function toIdentity(user: SessionIdentity): SessionIdentity {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
  };
}

/**
 * Pure SSR session decision:
 * - no session cookie (by name) → anon, no network
 * - valid signed cookie cache → authed, no network
 * - else /api/me with timeout: 200 → authed, 401 → anon, timeout/5xx/error → unknown
 *
 * The cookie cache only tells the SSR who the user is (shell identity). It is
 * never an authorization decision: the API ignores it and checks the database.
 */
export async function resolveSessionSSR(deps: {
  fetchMe: () => Promise<Response>;
  hasSessionCookie: boolean;
  readCachedIdentity: () => Promise<SessionIdentity | null>;
  timeoutMs: number;
}): Promise<SessionResult> {
  if (!deps.hasSessionCookie) {
    return { status: "anon" };
  }
  const cached = await deps.readCachedIdentity().catch(() => null);
  if (cached) {
    return { status: "authed", identity: cached, me: null };
  }
  const timeout = new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), deps.timeoutMs);
  });
  try {
    const res = await Promise.race([deps.fetchMe(), timeout]);
    if (res === "timeout") {
      return { status: "unknown" };
    }
    if (res.status === 200) {
      const me = (await res.json()) as SessionUser;
      return { status: "authed", identity: toIdentity(me), me };
    }
    return res.status === 401 ? { status: "anon" } : { status: "unknown" };
  } catch {
    return { status: "unknown" };
  }
}
