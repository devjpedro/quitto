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
  /** ISO timestamp of the account's creation ("no Quitto desde setembro de 2025"). */
  createdAt: string;
  emailRemindersAvailable: boolean;
  emailRemindersOptIn: boolean;
  /** False on a Google-only account: there is no password to change. */
  hasPassword: boolean;
  /** null = the user never chose a language (the browser decides until they do). */
  locale: Locale | null;
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
 * - valid identity hint → authed, no network
 * - else /api/me with timeout: 200 → authed, 401 → anon, timeout/5xx/error → unknown
 *
 * readIdentityHint returns a cosmetic identity hint the client wrote; never
 * authorization. It only tells the SSR which name to show in the shell: the
 * API validates the session against the database on every request.
 */
export async function resolveSessionSSR(deps: {
  fetchMe: (signal: AbortSignal) => Promise<Response>;
  hasSessionCookie: boolean;
  readIdentityHint: () => Promise<SessionIdentity | null>;
  timeoutMs: number;
}): Promise<SessionResult> {
  if (!deps.hasSessionCookie) {
    return { status: "anon" };
  }
  const hint = await deps.readIdentityHint().catch(() => null);
  if (hint) {
    return { status: "authed", identity: hint, me: null };
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => {
      // Don't leave a hung request to a cold API running behind the response.
      controller.abort();
      resolve("timeout");
    }, deps.timeoutMs);
  });
  try {
    const res = await Promise.race([deps.fetchMe(controller.signal), timeout]);
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
  } finally {
    clearTimeout(timer);
  }
}
