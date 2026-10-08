import { EnvelopeSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Emphasis } from "@/components/ui/emphasis";
import { StateHeading } from "@/features/invites/components/state-heading";
import { m } from "@/paraglide/messages.js";
import type { CheckEmailState } from "../hooks/use-login";

/** "Confira seu e-mail" (planner's decision 7): the link went out, and sending it again is the person's call. */
export function CheckEmail({
  error,
  loading,
  onChangeEmail,
  onResend,
  resent,
  state,
}: {
  error: string | null;
  loading: boolean;
  onChangeEmail: () => void;
  onResend: () => void;
  resent: boolean;
  state: CheckEmailState;
}) {
  const text =
    state.reason === "signup"
      ? m.auth_check_text({ email: state.email })
      : m.auth_check_unverified({ email: state.email });
  return (
    <div data-testid="check-email">
      <StateHeading
        icon={EnvelopeSimple}
        title={m.auth_check_title()}
        tone="brand"
      >
        <Emphasis strong={state.email} text={text} />
      </StateHeading>
      <div className="mt-6 flex flex-wrap gap-2.5">
        <Button
          className="bg-surface-card hover:bg-surface-card-hover"
          disabled={loading}
          onClick={onResend}
          size="lg"
          variant="ghost"
        >
          {m.auth_check_resend()}
        </Button>
        <Button onClick={onChangeEmail} size="lg" variant="ghost">
          {m.auth_check_other_email()}
        </Button>
      </div>
      <p className="mt-3 min-h-5 text-[13px]" role="status">
        {resent ? (
          <span className="text-ink-muted">{m.auth_check_resent()}</span>
        ) : null}
        {error ? (
          <span className="font-medium text-danger" role="alert">
            {error}
          </span>
        ) : null}
      </p>
    </div>
  );
}
