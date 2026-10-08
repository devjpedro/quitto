import { APP_TIME_ZONE, isoDateInTimeZone, type Locale } from "@quitto/shared";
import { weekdayLong } from "@/lib/date-parts";
import { formatDate } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";

const ROLE_LABEL: Record<string, () => string> = {
  buyer: () => m.home_role_buyer(),
  seller: () => m.home_role_seller(),
  viewer: () => m.home_role_viewer(),
};

/** "quem paga" / "the payer": the role an invite offers, in a sentence. */
export function roleLabel(role: string): string {
  return ROLE_LABEL[role]?.() ?? role;
}

/** The São Paulo calendar day of an instant ("2026-10-04"). */
export function dayOf(instant: string): string {
  return isoDateInTimeZone(new Date(instant), APP_TIME_ZONE);
}

/** "domingo, 04/10" / "Sunday, 10/04". */
export function weekdayDate(iso: string, locale: Locale): string {
  return m.invite_weekday_date(
    {
      weekday: weekdayLong(iso, locale),
      date: formatDate(iso, locale, "dayMonth"),
    },
    { locale }
  );
}

const timeFormatters = new Map<Locale, Intl.DateTimeFormat>();

/** "14:32" in São Paulo. */
export function timeOf(instant: string, locale: Locale): string {
  let formatter = timeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: APP_TIME_ZONE,
    });
    timeFormatters.set(locale, formatter);
  }
  return formatter.format(new Date(instant));
}

/** "Bia Lopes" → "Bia": the inviter in a sentence ("Bia vê na hora"). An e-mail stays whole. */
export function firstName(name: string): string {
  return name.trim().split(" ")[0] || name;
}
