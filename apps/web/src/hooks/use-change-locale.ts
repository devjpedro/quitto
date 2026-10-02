import type { Locale } from "@quitto/shared";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { m } from "@/paraglide/messages.js";
import { setLocale } from "@/paraglide/runtime.js";

/**
 * Saves the language on the account first (e-mails/PDFs follow it), and only
 * then switches the UI (cookie + reload). If the save fails the UI stays put:
 * the account locale wins over the cookie on the next load, so a half-applied
 * change would flip back.
 */
export function useChangeLocale(): (locale: Locale) => Promise<void> {
  const inFlight = useRef(false);
  return useCallback(async (locale: Locale) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    try {
      await unwrap(api.api.me.patch({ locale }));
    } catch {
      toast.error(m.account_language_error());
      return;
    } finally {
      inFlight.current = false;
    }
    setLocale(locale);
  }, []);
}
