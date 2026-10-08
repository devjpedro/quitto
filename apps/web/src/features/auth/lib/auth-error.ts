import { m } from "@/paraglide/messages.js";
import type { AuthMode } from "./login-copy";

/** Mínimo aceito pelo better-auth (emailAndPassword.minPasswordLength, default 8). */
export const MIN_PASSWORD_LENGTH = 8;

type AuthText = () => string;

/**
 * Wrong credentials and a missing account share one sentence on purpose:
 * telling them apart would let anyone list who has an account.
 */
const invalidCredentials: AuthText = () => m.auth_error_invalid_credentials();
const userExists: AuthText = () => m.auth_error_user_exists();

const BY_CODE: Record<string, AuthText> = {
  USER_ALREADY_EXISTS: userExists,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: userExists,
  PASSWORD_TOO_SHORT: () =>
    m.auth_error_password_short({ min: MIN_PASSWORD_LENGTH }),
  PASSWORD_TOO_LONG: () => m.auth_error_password_long(),
  PASSWORD_COMPROMISED: () => m.auth_error_password_compromised(),
  INVALID_EMAIL: () => m.auth_error_invalid_email(),
  INVALID_EMAIL_OR_PASSWORD: invalidCredentials,
  USER_NOT_FOUND: invalidCredentials,
  TOO_MANY_REQUESTS: () => m.auth_error_too_many(),
};

/** Better Auth's error in the reader's language; an unknown code gets the mode's generic sentence. */
export function authErrorMessage(
  error: { code?: string; message?: string } | null | undefined,
  mode: AuthMode
): string {
  const code = error?.code?.toUpperCase();
  const text = code ? BY_CODE[code] : undefined;
  if (text) {
    return text();
  }
  return mode === "signin" ? m.auth_error_signin() : m.auth_error_signup();
}
