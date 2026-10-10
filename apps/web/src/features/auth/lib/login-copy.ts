import { m } from "@/paraglide/messages.js";

export type AuthMode = "signin" | "signup";

/** The submit button; with an invite behind it, it says where it goes back to (H2). */
export function submitLabel(mode: AuthMode, invite: boolean) {
  if (invite) {
    return mode === "signin"
      ? m.login_invite_signin_submit()
      : m.login_invite_signup_submit();
  }
  return mode === "signin" ? m.auth_signin_submit() : m.auth_signup_submit();
}

/** The top of the form: with an invite behind it, the title says what for (H2). The sub only exists when there is something to add. */
export function heading(
  mode: AuthMode,
  invite: boolean
): { sub: string | null; title: string } {
  if (invite) {
    return mode === "signin"
      ? { title: m.login_invite_signin_title(), sub: null }
      : { title: m.login_invite_signup_title(), sub: null };
  }
  return mode === "signin"
    ? { title: m.auth_signin_title(), sub: null }
    : { title: m.auth_signup_title(), sub: m.auth_signup_sub() };
}

/** The e-mail field's description: the error, the invite's masked e-mail, both or none. */
export function describedBy(
  error: string | null,
  hint: boolean
): string | undefined {
  const ids = [error ? "auth-error" : null, hint ? "email-hint" : null].filter(
    Boolean
  );
  return ids.length > 0 ? ids.join(" ") : undefined;
}
