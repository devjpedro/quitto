import { auth } from "../auth";
import { UnauthorizedError } from "./errors";

/** Lê a sessão a partir dos headers; lança 401 se ausente. Sem macro/derive (mantém os tipos do Eden limpos). */
export async function requireAuth(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    throw new UnauthorizedError();
  }
  return { user: session.user, session: session.session };
}
