import type { Locale } from "@quitto/shared";
import { capitalize } from "@/lib/format";

/** "Outubro de 2026" / "October 2026". */
export function monthLabel(month: string, locale: Locale): string {
  return capitalize(
    new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${month}-01T00:00:00Z`))
  );
}
