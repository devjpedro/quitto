import { safeRedirect } from "@/lib/safe-redirect";

/** Only to tell a same-origin path from the rest; the link itself is relative. */
const VERIFY_ORIGIN = "https://quitto.invalid";

/** The sign-up/resend callbackURL: back through /verify-email, carrying the target. */
export function verifyCallback(target: string): string {
  return `/verify-email?redirect=${encodeURIComponent(target)}`;
}

/** Where /verify-email sends a confirmed person: a same-origin path, else "/". */
export function verifyTarget(raw: string | undefined): string {
  return safeRedirect(raw, VERIFY_ORIGIN);
}
