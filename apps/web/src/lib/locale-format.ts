import type { Locale } from "@quitto/shared";

export interface MoneyParts {
  currency: string;
  decimal: string;
  fraction: string;
  integer: string;
  sign: "" | "-";
}

export type DatePreset = "short" | "medium" | "long";

const SPACE_RE = / /g; // non-breaking space → regular space
const DAY_MS = 86_400_000;

const moneyFormatters = new Map<Locale, Intl.NumberFormat>();
function moneyFormatter(locale: Locale): Intl.NumberFormat {
  let formatter = moneyFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "BRL",
    });
    moneyFormatters.set(locale, formatter);
  }
  return formatter;
}

/** Integer cents → localized BRL string (amounts are always reais). */
export function formatMoney(cents: number, locale: Locale): string {
  return moneyFormatter(locale)
    .format(cents / 100)
    .replace(SPACE_RE, " ");
}

/** Splits a BRL amount so the integer can be rendered larger than the rest. */
export function moneyParts(cents: number, locale: Locale): MoneyParts {
  const parts: MoneyParts = {
    sign: "",
    currency: "",
    integer: "",
    decimal: "",
    fraction: "",
  };
  for (const part of moneyFormatter(locale).formatToParts(cents / 100)) {
    if (part.type === "minusSign") {
      parts.sign = "-";
    } else if (part.type === "currency") {
      parts.currency = part.value;
    } else if (part.type === "integer" || part.type === "group") {
      parts.integer += part.value;
    } else if (part.type === "decimal") {
      parts.decimal = part.value;
    } else if (part.type === "fraction") {
      parts.fraction = part.value;
    }
  }
  return parts;
}

const DATE_OPTIONS: Record<DatePreset, Intl.DateTimeFormatOptions> = {
  short: { day: "2-digit", month: "2-digit", year: "numeric" },
  medium: { day: "numeric", month: "short", year: "numeric" },
  long: { weekday: "long", day: "numeric", month: "long" },
};

function toUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Formats an ISO date (YYYY-MM-DD) as a calendar date, never shifting the day. */
export function formatDate(
  iso: string,
  locale: Locale,
  preset: DatePreset
): string {
  return new Intl.DateTimeFormat(locale, {
    ...DATE_OPTIONS[preset],
    timeZone: "UTC",
  }).format(toUtcDate(iso));
}

/** Whole calendar days from `fromIso` to `toIso` (negative when in the past). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (toUtcDate(toIso).getTime() - toUtcDate(fromIso).getTime()) / DAY_MS
  );
}

/** "hoje", "amanhã", "há 4 dias" / "today", "tomorrow", "4 days ago". */
export function formatRelativeDays(
  iso: string,
  todayIso: string,
  locale: Locale
): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    daysBetween(todayIso, iso),
    "day"
  );
}
