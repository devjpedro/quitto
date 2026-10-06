import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  clearIdentityCookie,
  usePersistIdentityCookie,
} from "@/hooks/use-identity-cookie";
import { useLocaleSync } from "@/hooks/use-locale-sync";
import { useMeQuery } from "@/hooks/use-me";
import { isSessionLost } from "@/lib/session-gate";

/**
 * The signed-in layouts' client half (the app and the wizard): keeps the
 * locale and the identity hint in step with /me, and sends a session that
 * is really gone (401) to /login.
 */
export function useSessionGate(): void {
  const me = useMeQuery();
  const navigate = useNavigate();
  const sessionLost = isSessionLost(me.error);

  useLocaleSync(me.data?.locale);
  usePersistIdentityCookie(me.data);

  useEffect(() => {
    if (sessionLost) {
      clearIdentityCookie();
      navigate({ to: "/login", search: { redirect: undefined } });
    }
  }, [sessionLost, navigate]);
}
