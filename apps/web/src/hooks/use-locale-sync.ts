import type { Locale } from "@quitto/shared";
import { useEffect } from "react";
import { getLocale, setLocale } from "@/paraglide/runtime.js";

/**
 * Brings the UI to the language the account chose.
 * - Chosen (non-null) and different from the UI: it wins over the browser
 *   cookie (e.g. first sign-in on a new device). setLocale writes the cookie
 *   and reloads, so this runs once.
 * - Not chosen (null): the browser decides; nothing is saved on the account
 *   until the user picks a language in the menu.
 * - undefined: /me has not loaded yet, nothing to do.
 */
export function useLocaleSync(accountLocale: Locale | null | undefined): void {
  useEffect(() => {
    if (accountLocale === undefined || accountLocale === null) {
      return;
    }
    if (accountLocale !== getLocale()) {
      setLocale(accountLocale);
    }
  }, [accountLocale]);
}
