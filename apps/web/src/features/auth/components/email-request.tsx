import { EnvelopeSimple } from "@phosphor-icons/react";
import { useHydrated } from "@tanstack/react-router";
import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Emphasis } from "@/components/ui/emphasis";
import { TextField } from "@/components/ui/field";
import { StateHeading } from "@/features/invites/components/state-heading";
import { m } from "@/paraglide/messages.js";

/**
 * Ask for an e-mail and send a link (forgot password, confirm again): the
 * title and the sentence, the field, one black button, and once it is sent
 * a neutral confirmation that names the typed address, the same with or
 * without an account behind it.
 */
export function EmailRequest({
  email,
  error,
  loading,
  onChange,
  onSubmit,
  sent,
  sentText,
  submitLabel,
  text,
  title,
}: {
  email: string;
  error: string | null;
  loading: boolean;
  onChange: (email: string) => void;
  onSubmit: (event: FormEvent) => void;
  /** The typed address once the link went out. */
  sent: boolean;
  sentText: string;
  submitLabel: string;
  text: string;
  title: ReactNode;
}) {
  // Before hydration a submit is a native one and would reload the page.
  const hydrated = useHydrated();
  if (sent) {
    return (
      <StateHeading
        icon={EnvelopeSimple}
        title={m.auth_check_title()}
        tone="brand"
      >
        <span role="status">
          <Emphasis strong={email} text={sentText} />
        </span>
      </StateHeading>
    );
  }
  return (
    <>
      <h1 className="font-display font-semibold text-[26px] leading-[1.2] tracking-[-0.03em] md:text-[28px]">
        {title}
      </h1>
      <p className="mt-2 text-ink-muted text-sm leading-[1.45]">{text}</p>
      <form className="mt-4 grid gap-4" method="post" onSubmit={onSubmit}>
        <TextField
          autoComplete="email"
          error={error ?? undefined}
          id="email"
          label={m.auth_email()}
          onChange={(event) => onChange(event.target.value)}
          placeholder={m.auth_email_placeholder()}
          required
          tall
          type="email"
          value={email}
        />
        <Button block disabled={loading || !hydrated} size="lg" type="submit">
          {loading ? m.auth_pending() : submitLabel}
        </Button>
      </form>
    </>
  );
}
