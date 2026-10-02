import { useCallback } from "react";
import { signOut } from "@/lib/auth-client";

/** Signs out and hard-navigates to /login (drops every cached query). */
export function useSignOut(): () => Promise<void> {
  return useCallback(async () => {
    await signOut();
    window.location.href = "/login";
  }, []);
}
