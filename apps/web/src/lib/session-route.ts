import type { QueryClient } from "@tanstack/react-query";
import { meQueryOptions } from "@/hooks/use-me";
import { queryKeys } from "@/lib/query-keys";
import type { SessionResult } from "@/lib/session-resolver";
import { getSessionSSR } from "@/lib/ssr-session";

/**
 * A route's beforeLoad, on the server only: decides the session without the
 * API when it can and seeds the cache with it. On the client the session
 * lives in the cache and the layout reacts to a 401 (useSessionGate); a
 * server function here would cost a round trip on every preload and click.
 * The caller decides what an anonymous visit means (the app redirects; the
 * invite page shows its preview).
 */
export async function seedSession(
  queryClient: QueryClient
): Promise<SessionResult["status"] | "client"> {
  if (typeof document !== "undefined") {
    return "client";
  }
  const session = await getSessionSSR();
  if (session.status === "authed") {
    queryClient.setQueryData(queryKeys.session, session.identity);
    if (session.me) {
      queryClient.setQueryData(meQueryOptions.queryKey, session.me);
    }
  }
  return session.status;
}
