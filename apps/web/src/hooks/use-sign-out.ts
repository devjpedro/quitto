import { useCallback } from "react";
import { clearIdentityCookie } from "@/hooks/use-identity-cookie";
import { signOut } from "@/lib/auth-client";

/** Signs out and hard-navigates to /login (drops every cached query). */
export function useSignOut(): () => Promise<void> {
  return useCallback(async () => {
    await signOut();
    clearIdentityCookie();
    window.location.href = "/login";
  }, []);
}
