import { useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useInvitePreview } from "@/features/invites/api";
import { inviteTokenOf } from "@/features/invites/lib/invite-redirect";
import { useApiWarmup } from "@/hooks/use-api-warmup";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { clearIdentityCookie } from "@/hooks/use-identity-cookie";
import { m } from "@/paraglide/messages.js";
import { useLogin } from "../hooks/use-login";
import { AuthFrame } from "./auth-frame";
import { AuthStage } from "./auth-stage";
import { CheckEmail } from "./check-email";
import { LoginForm } from "./login-form";

/**
 * /login: the showcase beside the form (mockup 19). The mode comes from the
 * URL (`?mode=signup`), so it works before hydration and "back" means
 * something; the invite behind the sign-in (F3) turns the showcase into the
 * invite and the form's title into "Entre para responder".
 */
export function LoginPage() {
  useDocumentTitle(m.page_title_login());
  useApiWarmup();
  // Every sign-in (e-mail, sign-up, Google) starts here and lands on a full
  // SSR load. A hint left by a previous user whose session expired would show
  // their name to the next one, so it goes before anyone signs in.
  useEffect(() => {
    clearIdentityCookie();
  }, []);
  const search = useSearch({ strict: false }) as {
    mode?: "signup";
    redirect?: string;
  };
  const mode = search.mode === "signup" ? "signup" : "signin";
  const invite = useInvitePreview(inviteTokenOf(search.redirect));
  const login = useLogin(mode, search.redirect);
  const { resetForMode } = login;
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a change of mode resets the form
  useEffect(() => {
    resetForMode();
  }, [mode]);

  let kind: "check-email" | "invite" | "showcase" = "showcase";
  if (login.check) {
    kind = "check-email";
  } else if (invite) {
    kind = "invite";
  }
  return (
    <AuthFrame stage={<AuthStage invite={invite} kind={kind} />}>
      {login.check ? (
        <CheckEmail
          error={login.error}
          loading={login.loading}
          onChangeEmail={login.changeEmail}
          onResend={login.resend}
          resent={login.resent}
          state={login.check}
        />
      ) : (
        <LoginForm
          emailRef={login.emailRef}
          error={login.error}
          invite={invite}
          loading={login.loading}
          mode={mode}
          onChange={(field, value) => {
            if (field === "name") {
              login.setName(value);
            } else if (field === "email") {
              login.setEmail(value);
            } else {
              login.setPassword(value);
            }
          }}
          onGoogle={login.google}
          onSubmit={login.submit}
          redirect={search.redirect}
          values={{
            email: login.email,
            name: login.name,
            password: login.password,
          }}
        />
      )}
    </AuthFrame>
  );
}
