import { useEffect, useRef } from "react";
import {
  clearIdentityCookieString,
  serializeIdentityCookie,
} from "@/lib/identity-cookie";
import { type SessionIdentity, toIdentity } from "@/lib/session-resolver";

/**
 * Keeps the cosmetic identity cookie (the SSR's name hint) in step with /me.
 * Writes only when the identity changes, not on every refetch.
 */
export function usePersistIdentityCookie(
  me: SessionIdentity | undefined
): void {
  const lastWritten = useRef<string | null>(null);
  useEffect(() => {
    if (!me) {
      return;
    }
    const cookie = serializeIdentityCookie(toIdentity(me), {
      secure: window.location.protocol === "https:",
    });
    if (cookie === lastWritten.current) {
      return;
    }
    lastWritten.current = cookie;
    // biome-ignore lint/suspicious/noDocumentCookie: first-party cookie read by the SSR, same pattern as the theme cookie
    document.cookie = cookie;
  }, [me]);
}

/** Removes the identity cookie (sign-out, account deletion, lost session). */
export function clearIdentityCookie(): void {
  // biome-ignore lint/suspicious/noDocumentCookie: first-party cookie read by the SSR, same pattern as the theme cookie
  document.cookie = clearIdentityCookieString();
}
