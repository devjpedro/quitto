import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { SessionIdentity } from "@/lib/session-resolver";

/**
 * Whether someone is signed in here, from what the SSR seeded (or the app
 * cached): no /me request, because an anonymous visitor's would be a 401.
 * An unknown session (a cold API) reads as signed out.
 */
export function useSignedIn(): boolean {
  const seeded = useQuery({
    queryKey: queryKeys.session,
    queryFn: (): SessionIdentity | null => null,
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return seeded.data != null;
}
