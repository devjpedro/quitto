import { useQuery } from "@tanstack/react-query";
import { meQueryOptions } from "@/hooks/use-me";
import { queryKeys } from "@/lib/query-keys";
import { type SessionIdentity, toIdentity } from "@/lib/session-resolver";

/** Who is signed in: fresh /me when available, otherwise the SSR seed (identity cookie). */
export function useIdentity(): SessionIdentity | null {
  const me = useQuery(meQueryOptions);
  const seeded = useQuery({
    queryKey: queryKeys.session,
    queryFn: (): SessionIdentity | null => null,
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  if (me.data) {
    return toIdentity(me.data);
  }
  return seeded.data ?? null;
}
