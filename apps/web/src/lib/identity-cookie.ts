import type { SessionIdentity } from "@/lib/session-resolver";

/**
 * A cosmetic identity hint the client writes after /me loads, so the SSR can
 * show the user's name without waking the API. It is never authorization:
 * anyone can write it, and the API always checks the session in the database.
 */
export const IDENTITY_COOKIE = "quitto_identity";

const MAX_AGE_S = 60 * 60 * 24 * 30;
const MAX_DECODED_LENGTH = 2048;

/** Full `document.cookie` assignment that stores the identity. */
export function serializeIdentityCookie(
  identity: SessionIdentity,
  { secure }: { secure: boolean }
): string {
  const { id, name, email } = identity;
  const value = encodeURIComponent(
    JSON.stringify({ id, name, email, image: identity.image ?? null })
  );
  const attributes = `Path=/; Max-Age=${MAX_AGE_S}; SameSite=Lax`;
  return `${IDENTITY_COOKIE}=${value}; ${attributes}${secure ? "; Secure" : ""}`;
}

/** `document.cookie` assignment that removes the identity cookie. */
export function clearIdentityCookieString(): string {
  return `${IDENTITY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function findCookieValue(header: string, name: string): string | null {
  const prefix = `${name}=`;
  for (const part of header.split(";")) {
    const pair = part.trim();
    if (pair.startsWith(prefix)) {
      return pair.slice(prefix.length);
    }
  }
  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function toIdentityShape(value: unknown): SessionIdentity | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { id, name, email, image } = value as Record<string, unknown>;
  if (
    !(isNonEmptyString(id) && isNonEmptyString(name) && isNonEmptyString(email))
  ) {
    return null;
  }
  if (image !== null && typeof image !== "string") {
    return null;
  }
  return { id, name, email, image };
}

/** Reads the identity from a Cookie header. Null on any failure, never throws. */
export function parseIdentityCookie(
  cookieHeader: string | null | undefined
): SessionIdentity | null {
  if (!cookieHeader) {
    return null;
  }
  const raw = findCookieValue(cookieHeader, IDENTITY_COOKIE);
  if (raw === null) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.length > MAX_DECODED_LENGTH) {
      return null;
    }
    return toIdentityShape(JSON.parse(decoded));
  } catch {
    return null;
  }
}
