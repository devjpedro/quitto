import { isRealISODate, type Locale } from "@quitto/shared";

const NON_DIGITS = /\D/g;
const DATE_LENGTH = 8;

/** Which part comes first when typing a date: the day in pt-BR, the month in en-US. */
function dayFirst(locale: Locale): boolean {
  return locale !== "en-US";
}

/** "dd/mm/aaaa" / "mm/dd/yyyy": the shape the field asks for. */
export function dateInputPlaceholder(locale: Locale): string {
  return dayFirst(locale) ? "dd/mm/aaaa" : "mm/dd/yyyy";
}

/** The typed digits with the slashes in place: "1011" becomes "10/11". At most eight digits. */
export function maskDateInput(text: string): string {
  const digits = text.replace(NON_DIGITS, "").slice(0, DATE_LENGTH);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
    .filter(Boolean)
    .join("/");
}

/** The ISO date a full, real "dd/mm/aaaa" (or "mm/dd/yyyy") stands for; null while it is partial or impossible. */
export function parseDateInput(text: string, locale: Locale): string | null {
  const digits = text.replace(NON_DIGITS, "");
  if (digits.length !== DATE_LENGTH) {
    return null;
  }
  const first = digits.slice(0, 2);
  const second = digits.slice(2, 4);
  const iso = `${digits.slice(4)}-${dayFirst(locale) ? second : first}-${dayFirst(locale) ? first : second}`;
  return isRealISODate(iso) ? iso : null;
}

/** An ISO date as the field shows it; "" when it is not one. */
export function formatDateInput(iso: string, locale: Locale): string {
  const [year, month, day] = iso.split("-");
  if (!(year && month && day && isRealISODate(iso))) {
    return "";
  }
  return dayFirst(locale)
    ? `${day}/${month}/${year}`
    : `${month}/${day}/${year}`;
}
