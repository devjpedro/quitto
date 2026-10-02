import { auth } from "../auth";
import { UnauthorizedError } from "./errors";

/** Lê a sessão a partir dos headers; lança 401 se ausente. Sem macro/derive (mantém os tipos do Eden limpos). */
export async function requireAuth(headers: Headers) {
  // The cookie cache is for the web SSR identity only; the API must see
  // revocations (sign-out elsewhere, account deletion) immediately.
  const session = await auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
  if (!session) {
    throw new UnauthorizedError();
  }
  return { user: session.user, session: session.session };
}
