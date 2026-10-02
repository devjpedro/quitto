import type { Locale } from "@quitto/shared";
import { useEffect } from "react";
import { getLocale, setLocale } from "@/paraglide/runtime.js";

/**
 * The account language wins over the browser cookie (e.g. first sign-in on a
 * new device). setLocale writes the cookie and reloads, so this runs once.
 */
export function useLocaleSync(accountLocale: Locale | undefined): void {
  useEffect(() => {
    if (accountLocale && accountLocale !== getLocale()) {
      setLocale(accountLocale);
    }
  }, [accountLocale]);
}
