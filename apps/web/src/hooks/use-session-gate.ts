import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  clearIdentityCookie,
  usePersistIdentityCookie,
} from "@/hooks/use-identity-cookie";
import { useLocaleSync } from "@/hooks/use-locale-sync";
import { meQueryOptions, useMeQuery } from "@/hooks/use-me";
import { queryKeys } from "@/lib/query-keys";
import { isSessionLost } from "@/lib/session-gate";

/**
 * The signed-in layouts' client half (the app and the wizard): keeps the
 * locale and the identity hint in step with /me, and sends a session that
 * is really gone (401) to /login.
 */
export function useSessionGate(): void {
  const me = useMeQuery();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionLost = isSessionLost(me.error);

  useLocaleSync(me.data?.locale);
  usePersistIdentityCookie(me.data);

  useEffect(() => {
    if (sessionLost) {
      clearIdentityCookie();
      // /login is reached client-side: a session still in the cache would
      // make its logo a link back to a home that bounces to /login.
      queryClient.removeQueries({ queryKey: queryKeys.session });
      queryClient.removeQueries({ queryKey: meQueryOptions.queryKey });
      navigate({ to: "/login", search: { redirect: undefined } });
    }
  }, [sessionLost, navigate, queryClient]);
}
