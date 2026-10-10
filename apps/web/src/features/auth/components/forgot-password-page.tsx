import { type FormEvent, useState } from "react";
import { useApiWarmup } from "@/hooks/use-api-warmup";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { requestPasswordReset } from "@/lib/auth-client";
import { m } from "@/paraglide/messages.js";
import { sendFailure } from "../lib/auth-error";
import { AuthFrame } from "./auth-frame";
import { AuthStage } from "./auth-stage";
import { BackToSignin } from "./back-link";
import { EmailRequest } from "./email-request";

const RESET_PATH = "/reset-password";

/** /forgot-password: the e-mail, and a confirmation that says the same with or without an account. */
export function ForgotPasswordPage() {
  useDocumentTitle(m.page_title_forgot());
  useApiWarmup();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}${RESET_PATH}`,
      });
      if (err) {
        setError(sendFailure(err));
        return;
      }
      setSent(true);
    } catch {
      setError(sendFailure(undefined));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame
      stage={
        <AuthStage
          invite={null}
          kind={sent ? "check-email" : "showcase"}
          mail="reset"
        />
      }
    >
      <BackToSignin />
      <EmailRequest
        email={email}
        error={error}
        loading={loading}
        onChange={setEmail}
        onSubmit={submit}
        sent={sent}
        sentText={m.auth_forgot_sent({ email })}
        submitLabel={m.auth_forgot_submit()}
        text={m.auth_forgot_text()}
        title={m.auth_forgot_title()}
      />
    </AuthFrame>
  );
}
