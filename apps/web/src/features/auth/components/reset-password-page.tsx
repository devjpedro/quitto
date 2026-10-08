import { CheckCircle, LinkBreak } from "@phosphor-icons/react";
import { Link, useSearch } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { StateHeading } from "@/features/invites/components/state-heading";
import { useApiWarmup } from "@/hooks/use-api-warmup";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { resetPassword } from "@/lib/auth-client";
import { m } from "@/paraglide/messages.js";
import {
  authErrorMessage,
  MIN_PASSWORD_LENGTH,
  sendFailure,
} from "../lib/auth-error";
import { AuthFrame } from "./auth-frame";
import { AuthStage } from "./auth-stage";
import { BackToSignin } from "./back-link";

const FIELD_ERRORS = new Set(["PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG"]);

function InvalidLink() {
  return (
    <>
      <StateHeading
        icon={LinkBreak}
        title={m.auth_reset_invalid_title()}
        tone="warning"
      >
        {m.auth_reset_invalid_text()}
      </StateHeading>
      <Button asChild className="mt-6" size="lg">
        <Link to="/forgot-password">{m.auth_reset_request_again()}</Link>
      </Button>
    </>
  );
}

/** /reset-password: the new password for the link's token; a missing, spent or expired link asks for another. */
export function ResetPasswordPage() {
  useDocumentTitle(m.page_title_reset());
  useApiWarmup();
  const search = useSearch({ strict: false }) as {
    error?: string;
    token?: string;
  };
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await resetPassword({
        newPassword: password,
        token: search.token ?? "",
      });
      if (!err) {
        setDone(true);
        return;
      }
      const code = err.code?.toUpperCase() ?? "";
      if (FIELD_ERRORS.has(code)) {
        setError(authErrorMessage(err, "signup"));
      } else if (code === "INVALID_TOKEN") {
        setInvalid(true);
      } else {
        setError(sendFailure(err));
      }
    } catch {
      setError(sendFailure(undefined));
    } finally {
      setLoading(false);
    }
  }

  let body = (
    <>
      <h1 className="font-display font-semibold text-[26px] leading-[1.2] tracking-[-0.03em] md:text-[28px]">
        {m.auth_reset_title()}
      </h1>
      <form className="mt-4 grid gap-4" onSubmit={submit}>
        <PasswordField
          autoComplete="new-password"
          error={error ?? undefined}
          hint={m.auth_password_hint({ min: MIN_PASSWORD_LENGTH })}
          id="new-password"
          label={m.auth_reset_label()}
          onChange={(event) => setPassword(event.target.value)}
          required
          tall
          value={password}
        />
        <Button block disabled={loading} size="lg" type="submit">
          {loading ? m.auth_pending() : m.auth_reset_submit()}
        </Button>
      </form>
    </>
  );
  if (!search.token || search.error || invalid) {
    body = <InvalidLink />;
  } else if (done) {
    body = (
      <>
        <StateHeading
          icon={CheckCircle}
          title={m.auth_reset_done_title()}
          tone="brand"
        >
          {m.auth_reset_done_text()}
        </StateHeading>
        <Button asChild className="mt-6" size="lg">
          <Link to="/login">{m.auth_signin_submit()}</Link>
        </Button>
      </>
    );
  }
  return (
    <AuthFrame stage={<AuthStage invite={null} kind="showcase" />}>
      {done ? null : <BackToSignin />}
      {body}
    </AuthFrame>
  );
}
