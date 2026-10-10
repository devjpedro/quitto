import type { Locale } from "@quitto/shared";
import { moneyParts } from "@/lib/locale-format";

const NOT_MONEY = /[^0-9.,]/g;
const DIGIT = /[0-9]/;
const SEPARATORS = /[.,]/g;

/**
 * Cents from what a person typed, in either language: the last "," or "."
 * followed by one or two digits is the decimal mark; any other is a
 * thousands mark ("6.000" is six thousand). Null when there is no number.
 */
export function parseMoneyInput(text: string): number | null {
  const cleaned = text.replace(NOT_MONEY, "");
  if (!DIGIT.test(cleaned)) {
    return null;
  }
  const last = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  let integer = cleaned;
  let fraction = "";
  if (last >= 0) {
    const after = cleaned.slice(last + 1);
    if (after.length > 0 && after.length <= 2) {
      integer = cleaned.slice(0, last);
      fraction = after;
    }
  }
  const whole = Number(integer.replace(SEPARATORS, "") || "0");
  const cents = whole * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** "6.000,00" / "6,000.00": the amount in the field, without the currency (it is the field's leading mark). */
export function formatMoneyInput(cents: number, locale: Locale): string {
  const parts = moneyParts(cents, locale);
  return `${parts.sign}${parts.integer}${parts.decimal}${parts.fraction}`;
}
