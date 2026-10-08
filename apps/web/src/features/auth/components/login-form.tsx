import { GoogleLogo } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { FormEvent, Ref } from "react";
import { Button } from "@/components/ui/button";
import { Emphasis } from "@/components/ui/emphasis";
import { TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import type { PublicInvitePreview } from "@/features/invites/api";
import { m } from "@/paraglide/messages.js";
import { MIN_PASSWORD_LENGTH } from "../lib/auth-error";
import {
  type AuthMode,
  describedBy,
  heading,
  submitLabel,
} from "../lib/login-copy";

interface Values {
  email: string;
  name: string;
  password: string;
}

/** The sign-in / sign-up form (mockup 18, kept by mockup 19): black as the action, field-line on the fields, "Esqueci a senha" on the password's label. */
export function LoginForm({
  emailRef,
  error,
  invite,
  loading,
  mode,
  onChange,
  onGoogle,
  onSubmit,
  redirect,
  values,
}: {
  emailRef: Ref<HTMLInputElement>;
  error: string | null;
  invite: PublicInvitePreview | null;
  loading: boolean;
  mode: AuthMode;
  onChange: (field: keyof Values, value: string) => void;
  onGoogle: () => void;
  onSubmit: (event: FormEvent) => void;
  redirect: string | undefined;
  values: Values;
}) {
  const signup = mode === "signup";
  const head = heading(mode, invite !== null);
  const invalid = error ? true : undefined;
  return (
    <>
      <h1 className="font-display font-semibold text-[26px] leading-[1.2] tracking-[-0.03em] md:text-[28px]">
        {head.title}
      </h1>
      {head.sub ? (
        <p className="mt-2 text-ink-muted text-sm leading-[1.45]">{head.sub}</p>
      ) : null}
      <Button
        block
        className="mt-6 bg-surface-card hover:bg-surface-card-hover"
        disabled={loading}
        onClick={onGoogle}
        size="lg"
        variant="ghost"
      >
        <GoogleLogo aria-hidden="true" size={18} weight="bold" />
        {m.auth_google()}
      </Button>
      <div
        aria-hidden="true"
        className="mt-5 flex items-center gap-3 text-[13px] text-ink-muted"
      >
        <i className="h-px flex-1 bg-line-strong" />
        {m.auth_or()}
        <i className="h-px flex-1 bg-line-strong" />
      </div>
      <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
        {signup ? (
          <TextField
            autoComplete="name"
            id="name"
            label={m.auth_name()}
            onChange={(event) => onChange("name", event.target.value)}
            required
            tall
            value={values.name}
          />
        ) : null}
        <div>
          <TextField
            aria-describedby={describedBy(error, invite !== null)}
            aria-invalid={invalid}
            autoComplete="email"
            id="email"
            label={m.auth_email()}
            onChange={(event) => onChange("email", event.target.value)}
            placeholder={m.auth_email_placeholder()}
            ref={emailRef}
            required
            tall
            type="email"
            value={values.email}
          />
          {invite ? (
            <p className="mt-1.5 text-[12.5px] text-ink-muted" id="email-hint">
              <Emphasis
                strong={invite.emailMasked}
                text={m.login_invite_hint({ masked: invite.emailMasked })}
              />
            </p>
          ) : null}
        </div>
        <PasswordField
          aria-describedby={describedBy(error, false)}
          aria-invalid={invalid}
          autoComplete={signup ? "new-password" : "current-password"}
          hint={
            signup
              ? m.auth_password_hint({ min: MIN_PASSWORD_LENGTH })
              : undefined
          }
          id="password"
          label={m.auth_password()}
          labelAside={
            signup ? null : (
              <Link
                className="rounded-[4px] font-semibold text-[13px] text-ink underline-offset-[3px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                to="/forgot-password"
              >
                {m.auth_forgot_link()}
              </Link>
            )
          }
          onChange={(event) => onChange("password", event.target.value)}
          required
          tall
          value={values.password}
        />
        {error ? (
          <p
            className="font-medium text-danger text-sm"
            id="auth-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <Button
          block
          className="mt-2"
          disabled={loading}
          size="lg"
          type="submit"
        >
          {loading ? m.auth_pending() : submitLabel(mode, invite !== null)}
        </Button>
      </form>
      <p className="mt-5 text-center text-ink-muted text-sm">
        {signup ? m.auth_to_signin_lead() : m.auth_to_signup_lead()}{" "}
        <Link
          className="rounded-[4px] font-semibold text-ink underline decoration-line-strong underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          replace
          search={{ redirect, ...(signup ? {} : { mode: "signup" as const }) }}
          to="/login"
        >
          {signup ? m.auth_to_signin() : m.auth_to_signup()}
        </Link>
      </p>
    </>
  );
}
