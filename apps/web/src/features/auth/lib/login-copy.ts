import { m } from "@/paraglide/messages.js";

export type AuthMode = "signin" | "signup";

/** The submit button; with an invite behind it, it says where it goes back to (H2). */
export function submitLabel(mode: AuthMode, invite: boolean) {
  if (invite) {
    return mode === "signin"
      ? m.login_invite_signin_submit()
      : m.login_invite_signup_submit();
  }
  return mode === "signin" ? "Entrar" : "Criar conta";
}

/** The top of the form: with an invite behind it, the title says what for (H2). */
export function heading(
  mode: AuthMode,
  invite: boolean
): { sub: string; title: string } {
  if (invite) {
    return mode === "signin"
      ? {
          title: m.login_invite_signin_title(),
          sub: m.login_invite_signin_sub(),
        }
      : {
          title: m.login_invite_signup_title(),
          sub: m.login_invite_signup_sub(),
        };
  }
  return mode === "signin"
    ? { title: "Entre na sua conta", sub: "Bem-vindo de volta ao Quitto." }
    : { title: "Crie sua conta", sub: "É rápido e grátis." };
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
