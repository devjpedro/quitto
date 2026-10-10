import { useQuery } from "@tanstack/react-query";
import { meQueryOptions } from "@/hooks/use-me";
import { queryKeys } from "@/lib/query-keys";

/**
 * Whether a session is known, read from the cache only: the root seeds it on
 * the server and /me fills it. Unlike useIdentity it never fetches, so a
 * public page (login, receipt, an invite without an account) does not call
 * /api/me just to draw its logo.
 */
export function useSignedIn(): boolean {
  const me = useQuery({ ...meQueryOptions, enabled: false });
  const seeded = useQuery({
    queryKey: queryKeys.session,
    queryFn: () => null,
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return Boolean(me.data ?? seeded.data);
}
