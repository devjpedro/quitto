import { type FormEvent, useEffect, useRef, useState } from "react";
import { sendVerificationEmail, signIn, signUp } from "@/lib/auth-client";
import { safeRedirect } from "@/lib/safe-redirect";
import { m } from "@/paraglide/messages.js";
import { authErrorMessage } from "../lib/auth-error";
import type { AuthMode } from "../lib/login-copy";
import { verifyCallback } from "../lib/verify-redirect";

const UNVERIFIED_EMAIL_RE = /verif/i;

/** "Confira seu e-mail": why the person is there (a new account, or an e-mail never confirmed). */
export interface CheckEmailState {
  email: string;
  reason: "signup" | "unverified";
}

/** The place to land after signing in: a same-origin path, read in a handler (the origin does not exist on the server). */
function landingTarget(redirect: string | undefined): string {
  return safeRedirect(redirect, window.location.origin);
}

/**
 * The sign-in / sign-up flow of the login screen: the fields, the request,
 * the error, and the "Confira seu e-mail" state (planner's decision 7). The
 * mode and the redirect come from the URL. Sending the link again is a
 * button, never automatic.
 */
export function useLogin(mode: AuthMode, redirect: string | undefined) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [check, setCheck] = useState<CheckEmailState | null>(null);
  const [resent, setResent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const [focusEmail, setFocusEmail] = useState(0);

  useEffect(() => {
    if (focusEmail > 0) {
      emailRef.current?.focus();
    }
  }, [focusEmail]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const target = landingTarget(redirect);
    try {
      if (mode === "signin") {
        const { error: err } = await signIn.email({
          email,
          password,
          callbackURL: target,
        });
        if (!err) {
          window.location.href = target;
          return;
        }
        const notVerified =
          err.code === "EMAIL_NOT_VERIFIED" ||
          UNVERIFIED_EMAIL_RE.test(err.message ?? "");
        if (notVerified) {
          setPassword("");
          setCheck({ email, reason: "unverified" });
          return;
        }
        setError(authErrorMessage(err, mode));
        return;
      }
      const { data, error: err } = await signUp.email({
        name,
        email,
        password,
        callbackURL: verifyCallback(target),
      });
      if (err) {
        setError(authErrorMessage(err, mode));
        return;
      }
      // With e-mail verification on, there is no session yet, and the answer is
      // the same for an e-mail that already has an account.
      if (data && data.token === null) {
        setPassword("");
        setCheck({ email, reason: "signup" });
        return;
      }
      window.location.href = target;
    } catch {
      setError(authErrorMessage(undefined, mode));
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await signIn.social({
        provider: "google",
        callbackURL: landingTarget(redirect),
      });
      if (err) {
        setError(m.auth_google_failed());
      }
    } catch {
      setError(m.auth_google_failed());
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!check) {
      return;
    }
    setResent(false);
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await sendVerificationEmail({
        email: check.email,
        callbackURL: verifyCallback(landingTarget(redirect)),
      });
      if (err) {
        setError(authErrorMessage(err, "signin"));
        return;
      }
      setResent(true);
    } catch {
      setError(authErrorMessage(undefined, "signin"));
    } finally {
      setLoading(false);
    }
  }

  /** Back to the form with the e-mail typed, the password empty and the cursor on the e-mail. */
  function changeEmail() {
    setCheck(null);
    setResent(false);
    setError(null);
    setFocusEmail((n) => n + 1);
  }

  /** The other mode is another form: its error and its name do not carry over. */
  function resetForMode() {
    setError(null);
    setName("");
  }

  return {
    check,
    email,
    emailRef,
    error,
    google,
    loading,
    name,
    password,
    resend,
    resent,
    resetForMode,
    setEmail,
    setName,
    setPassword,
    submit,
    changeEmail,
  };
}
