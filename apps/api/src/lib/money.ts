import type { Locale } from "@quitto/shared";

const FORMATTERS = new Map<Locale, Intl.NumberFormat>();

function formatterFor(locale: Locale): Intl.NumberFormat {
  let f = FORMATTERS.get(locale);
  if (!f) {
    f = new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" });
    FORMATTERS.set(locale, f);
  }
  return f;
}

/** Formats integer cents as BRL in the locale ("R$ 1.234,56" / "R$1,234.56"). */
export function formatCents(cents: number, locale: Locale): string {
  // Replace non-breaking space (U+00A0) and narrow no-break space (U+202F) with a regular space
  return formatterFor(locale)
    .format(cents / 100)
    .replace(/[  ]/g, " ");
}

/** Brazilian shorthand, kept until the last caller moves to formatCents. */
export function formatCentsBRL(cents: number): string {
  return formatCents(cents, "pt-BR");
}
