import { DEFAULT_LOCALE, isLocale, type Locale } from "@quitto/shared";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { user } from "../db/schema";
import { normalizeEmail } from "./email";

/** The Paraglide cookie the web writes (apps/web/paraglide.config.ts, cookieName). */
export const LOCALE_COOKIE = "locale";

function cookieLocale(header: string | null): Locale | null {
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1 || part.slice(0, eq).trim() !== LOCALE_COOKIE) {
      continue;
    }
    try {
      const value = decodeURIComponent(part.slice(eq + 1).trim());
      if (isLocale(value)) {
        return value;
      }
    } catch {
      // malformed cookie value: ignore
    }
  }
  return null;
}

function tagToLocale(tag: string): Locale | null {
  const primary = tag.trim().toLowerCase().split("-")[0];
  if (primary === "pt") {
    return "pt-BR";
  }
  if (primary === "en") {
    return "en-US";
  }
  return null;
}

function acceptLanguageLocale(header: string | null): Locale | null {
  if (!header) {
    return null;
  }
  const ranked = header
    .split(",")
    .map((item, index) => {
      const [tag = "", ...params] = item.split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      const weight = q === undefined ? 1 : Number(q);
      return { index, locale: tagToLocale(tag), weight };
    })
    .filter((c) => c.locale && Number.isFinite(c.weight) && c.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return ranked[0]?.locale ?? null;
}

/** The request's language: the `locale` cookie when valid, else the first supported Accept-Language tag by q; null when neither. */
export function localeFromHeaders(headers: Headers | undefined): Locale | null {
  if (!headers) {
    return null;
  }
  return (
    cookieLocale(headers.get("cookie")) ??
    acceptLanguageLocale(headers.get("accept-language"))
  );
}

/** The first candidate that is a Locale (isLocale from @quitto/shared), else DEFAULT_LOCALE. */
export function pickLocale(
  ...candidates: (string | null | undefined)[]
): Locale {
  for (const c of candidates) {
    if (isLocale(c)) {
      return c;
    }
  }
  return DEFAULT_LOCALE;
}

function asLocale(value: string | null | undefined): Locale | null {
  return isLocale(value) ? value : null;
}

/** The account's chosen language (user.locale), null when not chosen or no such user. */
export async function userLocale(userId: string): Promise<Locale | null> {
  const [row] = await db
    .select({ locale: user.locale })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return asLocale(row?.locale);
}

/** The language of the account that owns this e-mail (normalizeEmail), null without an account. */
export async function localeOfEmail(email: string): Promise<Locale | null> {
  const [row] = await db
    .select({ locale: user.locale })
    .from(user)
    .where(eq(user.email, normalizeEmail(email)))
    .limit(1);
  return asLocale(row?.locale);
}
