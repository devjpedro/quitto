import type { Locale } from "@quitto/shared";

export interface MoneyParts {
  currency: string;
  decimal: string;
  fraction: string;
  integer: string;
  sign: "" | "-";
}

export type DatePreset =
  | "short"
  | "medium"
  | "long"
  | "dayMonth"
  | "weekdayShort";

const SPACE_RE = /[\u00A0\u202F]/g; // non-breaking space (U+00A0) and narrow no-break space (U+202F) → regular space
const DAY_MS = 86_400_000;

/** Replaces NBSP (U+00A0) and narrow NBSP (U+202F) from ICU output with plain spaces. */
export function normalizeSpaces(text: string): string {
  return text.replace(SPACE_RE, " ");
}

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

/** -0 → +0, so zero never renders as "-R$ 0,00" (-0 === 0 is true). */
function toReais(cents: number): number {
  const value = cents === 0 ? 0 : cents;
  return value / 100;
}

/** Integer cents → localized BRL string (amounts are always reais). */
export function formatMoney(cents: number, locale: Locale): string {
  return normalizeSpaces(moneyFormatter(locale).format(toReais(cents)));
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
  for (const part of moneyFormatter(locale).formatToParts(toReais(cents))) {
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
  dayMonth: { day: "2-digit", month: "2-digit" },
  weekdayShort: { weekday: "short", day: "2-digit", month: "2-digit" },
};

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
function dateFormatter(
  locale: Locale,
  preset: DatePreset
): Intl.DateTimeFormat {
  const key = `${locale}|${preset}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      ...DATE_OPTIONS[preset],
      timeZone: "UTC",
    });
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

const monthFormatters = new Map<Locale, Intl.DateTimeFormat>();
const dayFormatters = new Map<Locale, Intl.RelativeTimeFormat>();
const timeFormatters = new Map<Locale, Intl.RelativeTimeFormat>();

function cached<T>(cache: Map<Locale, T>, locale: Locale, make: () => T): T {
  let value = cache.get(locale);
  if (!value) {
    value = make();
    cache.set(locale, value);
  }
  return value;
}

function toUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/**
 * Formats a calendar date (YYYY-MM-DD) without ever shifting the day.
 * Date-only strings: for instants (timestamps) use formatRelativeTime.
 */
export function formatDate(
  iso: string,
  locale: Locale,
  preset: DatePreset
): string {
  return dateFormatter(locale, preset).format(toUtcDate(iso));
}

/** Month name of a "YYYY-MM": "setembro" / "September". */
export function formatMonthName(month: string, locale: Locale): string {
  return cached(
    monthFormatters,
    locale,
    () => new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" })
  ).format(toUtcDate(`${month}-01`));
}

/** Whole calendar days from `fromIso` to `toIso` (negative when in the past). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (toUtcDate(toIso).getTime() - toUtcDate(fromIso).getTime()) / DAY_MS
  );
}

/** "hoje", "amanhã", "há 4 dias" / "today", "tomorrow", "4 days ago". Date-only strings. */
export function formatRelativeDays(
  iso: string,
  todayIso: string,
  locale: Locale
): string {
  return cached(
    dayFormatters,
    locale,
    () => new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  ).format(daysBetween(todayIso, iso), "day");
}

const YEAR_SECONDS = 31_557_600;
const TIME_STEPS: {
  limit: number;
  seconds: number;
  unit: Intl.RelativeTimeFormatUnit;
}[] = [
  { limit: 60, seconds: 1, unit: "second" },
  { limit: 3600, seconds: 60, unit: "minute" },
  { limit: 86_400, seconds: 3600, unit: "hour" },
  { limit: 604_800, seconds: 86_400, unit: "day" },
  { limit: 2_629_800, seconds: 604_800, unit: "week" },
  { limit: YEAR_SECONDS, seconds: 2_629_800, unit: "month" },
];

/**
 * "há 2 h", "ontem", "há 3 dias" for a past instant (ISO timestamp). `nowMs`
 * is injectable. A timestamp a few seconds ahead (client clock behind the
 * server's) reads as "agora", never "em 3 s".
 */
export function formatRelativeTime(
  isoTimestamp: string,
  nowMs: number,
  locale: Locale
): string {
  const diffSeconds = Math.min(
    0,
    Math.round((Date.parse(isoTimestamp) - nowMs) / 1000)
  );
  const step = TIME_STEPS.find((s) => Math.abs(diffSeconds) < s.limit) ?? {
    seconds: YEAR_SECONDS,
    unit: "year" as const,
  };
  const formatter = cached(
    timeFormatters,
    locale,
    () =>
      new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" })
  );
  return normalizeSpaces(
    formatter.format(Math.round(diffSeconds / step.seconds), step.unit)
  );
}
