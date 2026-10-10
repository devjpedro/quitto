import type { Locale } from "@quitto/shared";

/** Language names are endonyms: they read the same in every UI locale. */
export const LOCALE_NAME: Record<Locale, string> = {
  "pt-BR": "Português (Brasil)",
  "en-US": "English (US)",
};

/** The same names without the region, for a switch with little room (the name above is its accessible name). */
export const LOCALE_SHORT_NAME: Record<Locale, string> = {
  "pt-BR": "Português",
  "en-US": "English",
};
