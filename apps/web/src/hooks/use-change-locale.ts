import type { Locale } from "@quitto/shared";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { setLocale } from "@/paraglide/runtime.js";

/** Persists the language on the account (e-mails/PDFs) and switches the UI (cookie + reload). */
export function useChangeLocale(): (locale: Locale) => Promise<void> {
  return useCallback(async (locale: Locale) => {
    await api.api.me.patch({ locale }).catch(() => undefined);
    setLocale(locale);
  }, []);
}
