import type { Locale } from "@quitto/shared";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { getLocale, setLocale } from "@/paraglide/runtime.js";

/**
 * Keeps the account language and the UI language in step.
 * - The user chose a language (non-null): it wins over the browser cookie
 *   (e.g. first sign-in on a new device). setLocale writes the cookie and
 *   reloads, so this runs once.
 * - The user never chose one (null): the browser decides, so what they are
 *   seeing is saved on the account (once per mount). No reload: the UI already
 *   shows that language. From then on, e-mails and PDFs follow it too.
 * - undefined: /me has not loaded yet, nothing to do.
 */
export function useLocaleSync(accountLocale: Locale | null | undefined): void {
  const savedDefault = useRef(false);
  useEffect(() => {
    if (accountLocale === undefined) {
      return;
    }
    if (accountLocale === null) {
      if (savedDefault.current) {
        return;
      }
      savedDefault.current = true;
      // Best-effort default: if it fails, the next load tries again.
      unwrap(api.api.me.patch({ locale: getLocale() })).catch(() => undefined);
      return;
    }
    if (accountLocale !== getLocale()) {
      setLocale(accountLocale);
    }
  }, [accountLocale]);
}
