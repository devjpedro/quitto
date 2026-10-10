import {
  ClockCountdown,
  HourglassMedium,
  Info,
  LockSimple,
  SignIn,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Emphasis } from "@/components/ui/emphasis";
import { AuthFrame } from "@/features/auth/components/auth-frame";
import { AuthStage } from "@/features/auth/components/auth-stage";
import { heading } from "@/features/auth/lib/login-copy";
import { whatsappUrl } from "@/features/installments/lib/whatsapp-message";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { invitePreviewQueryOptions, type PublicInvitePreview } from "../api";
import { dayOf, firstName, weekdayDate } from "../lib/invite-format";
import { invitePath } from "../lib/invite-redirect";
import { InviteMissing, InviteNotice } from "./invite-missing";
import { StateHeading } from "./state-heading";

function SignInLink({ token }: { token: string }) {
  return (
    <Button asChild block size="lg">
      <Link search={{ redirect: invitePath(token) }} to="/login">
        <SignIn aria-hidden="true" size={18} />
        {m.invite_guest_signin()}
      </Link>
    </Button>
  );
}

/**
 * The invite to answer, before signing in (mockup 19, A4): the showcase
 * carries who, what and the terms; the column only says what for and gives
 * the way in, which comes back here.
 */
function GuestPending({
  preview,
  token,
}: {
  preview: PublicInvitePreview;
  token: string;
}) {
  return (
    <>
      <h1 className="font-display font-semibold text-[26px] leading-[1.2] tracking-[-0.03em] md:text-[28px]">
        {heading("signin", true).title}
      </h1>
      <p className="mt-[18px] flex items-start gap-3 rounded-card bg-surface-card px-4 py-3.5 text-[13px] text-ink-muted leading-[1.45]">
        <LockSimple
          aria-hidden="true"
          className="mt-px shrink-0 text-brand"
          size={18}
        />
        <Emphasis
          strong={preview.emailMasked}
          text={m.invite_guest_lock({ masked: preview.emailMasked })}
        />
      </p>
      <div className="mt-5">
        <SignInLink token={token} />
      </div>
      <p className="mt-5 text-center text-ink-muted text-sm">
        {m.auth_to_signup_lead()}{" "}
        <Link
          className="rounded-[4px] font-semibold text-ink underline decoration-line-strong underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          search={{ redirect: invitePath(token), mode: "signup" }}
          to="/login"
        >
          {m.auth_to_signup()}
        </Link>
      </p>
    </>
  );
}

/** An ended invite, before signing in: expired asks the inviter again; answered asks to sign in. */
function GuestEnded({
  preview,
  token,
}: {
  preview: PublicInvitePreview;
  token: string;
}) {
  if (preview.status === "expired") {
    const inviter = firstName(preview.inviterName);
    const ask = whatsappUrl([
      m.invite_whatsapp_message({
        name: inviter,
        title: preview.contractTitle,
      }),
    ]);
    return (
      <>
        <StateHeading
          icon={ClockCountdown}
          title={m.invite_expired_title()}
          tone="warning"
        >
          {m.invite_expired_text({
            date: weekdayDate(dayOf(preview.expiresAt), getLocale()),
            name: inviter,
          })}
        </StateHeading>
        <Button asChild block className="mt-6" size="lg">
          <a href={ask} rel="noopener noreferrer" target="_blank">
            <WhatsappLogo aria-hidden="true" size={18} />
            {m.invite_ask_whatsapp()}
          </a>
        </Button>
      </>
    );
  }
  return (
    <>
      <StateHeading
        icon={Info}
        title={m.invite_guest_answered_title()}
        tone="neutral"
      >
        <Emphasis
          strong={preview.emailMasked}
          text={m.invite_guest_answered_text({ masked: preview.emailMasked })}
        />
      </StateHeading>
      <div className="mt-6">
        <SignInLink token={token} />
      </div>
    </>
  );
}

/**
 * /invites/$token without a session (owner's decision 12): the public
 * preview, in the sign-in's showcase (mockup 19, decision 5) and without
 * the ✕ (there is no app behind it yet). An ended invite keeps the plain showcase.
 */
export function InviteGuest({ token }: { token: string }) {
  const { data } = useSuspenseQuery(invitePreviewQueryOptions(token));
  if (data.kind === "missing") {
    return <InviteMissing />;
  }
  if (data.kind === "rateLimited") {
    // 30 previews a minute per visitor (Task 3): a sentence to wait, not a broken page.
    return (
      <InviteNotice
        icon={HourglassMedium}
        title={m.invite_rate_limited_title()}
        tone="warning"
        withExit={false}
      >
        {m.invite_rate_limited_text()}
      </InviteNotice>
    );
  }
  const { preview } = data;
  const pending = preview.status === "pending" && preview.terms;
  return (
    <AuthFrame
      stage={
        <AuthStage invite={preview} kind={pending ? "invite" : "showcase"} />
      }
    >
      {pending ? (
        <GuestPending preview={preview} token={token} />
      ) : (
        <GuestEnded preview={preview} token={token} />
      )}
    </AuthFrame>
  );
}
