import { useSearch } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useApiWarmup } from "@/hooks/use-api-warmup";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { sendVerificationEmail } from "@/lib/auth-client";
import { m } from "@/paraglide/messages.js";
import { sendFailure } from "../lib/auth-error";
import { verifyCallback, verifyTarget } from "../lib/verify-redirect";
import { AuthFrame } from "./auth-frame";
import { AuthStage } from "./auth-stage";
import { BackToSignin } from "./back-link";
import { EmailRequest } from "./email-request";

/** /verify-email with an error: the link that confirms an e-mail expired or is not valid, so ask for another (a confirmed e-mail never gets here). */
export function VerifyEmailPage() {
  useDocumentTitle(m.page_title_verify());
  useApiWarmup();
  const search = useSearch({ strict: false }) as {
    error?: string;
    redirect?: string;
  };
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await sendVerificationEmail({
        email,
        callbackURL: verifyCallback(verifyTarget(search.redirect)),
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
    <AuthFrame stage={<AuthStage invite={null} kind="showcase" />}>
      <BackToSignin />
      <EmailRequest
        email={email}
        error={error}
        loading={loading}
        onChange={setEmail}
        onSubmit={submit}
        sent={sent}
        sentText={m.auth_verify_sent({ email })}
        submitLabel={m.auth_verify_submit()}
        text={m.auth_verify_text()}
        title={
          search.error === "TOKEN_EXPIRED"
            ? m.auth_verify_expired_title()
            : m.auth_verify_invalid_title()
        }
      />
    </AuthFrame>
  );
}
