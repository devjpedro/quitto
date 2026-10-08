import {
  Bell,
  CalendarDots,
  CheckCircle,
  ClockCountdown,
  HourglassMedium,
  Info,
  LockSimple,
  SignIn,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { todayISO } from "@quitto/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { StepFrame, StepHeader } from "@/components/layout/step-frame";
import { Button } from "@/components/ui/button";
import { Emphasis } from "@/components/ui/emphasis";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { whatsappUrl } from "@/features/installments/lib/whatsapp-message";
import { inviteTerms } from "@/lib/invite-terms-text";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { invitePreviewQueryOptions, type PublicInvitePreview } from "../api";
import { dayOf, firstName, roleLabel, weekdayDate } from "../lib/invite-format";
import { invitePath } from "../lib/invite-redirect";
import { InviteBar } from "./invite-bar";
import { type InfoRow, InviteInfoList } from "./invite-info-list";
import { InviteMissing, InviteNotice } from "./invite-missing";
import { InviteRail } from "./invite-rail";
import { StateHeading } from "./state-heading";

function howRows(): InfoRow[] {
  return [
    {
      icon: CalendarDots,
      line: m.invite_guest_how_schedule(),
      hint: m.invite_guest_how_schedule_hint(),
    },
    {
      icon: Bell,
      line: m.invite_guest_how_reminder(),
      hint: m.invite_guest_how_reminder_hint(),
    },
    {
      icon: CheckCircle,
      line: m.invite_guest_how_paid(),
      hint: m.invite_guest_how_paid_hint(),
    },
  ];
}

function SignInLink({ token }: { token: string }) {
  return (
    <Button asChild className="flex-1" size="lg">
      <Link search={{ redirect: invitePath(token) }} to="/login">
        <SignIn aria-hidden="true" size={18} />
        {m.invite_guest_signin()}
      </Link>
    </Button>
  );
}

/** The invite to answer, before signing in (mockup 15, H1): what it is, and the way in that comes back here. */
function GuestPending({
  preview,
  terms: raw,
  token,
}: {
  preview: PublicInvitePreview;
  /** The public preview carries terms only while pending (Task 3). */
  terms: NonNullable<PublicInvitePreview["terms"]>;
  token: string;
}) {
  const role = roleLabel(preview.role);
  const terms = inviteTerms(raw, todayISO(), getLocale());
  return (
    <>
      <p className="flex items-center gap-2.5 text-ink-muted text-sm leading-[1.35]">
        <PersonAvatar name={preview.inviterName} size="md" />
        <Emphasis
          strong={preview.inviterName}
          text={m.invite_guest_from({ name: preview.inviterName })}
        />
      </p>
      <h1 className="mt-3.5 font-display font-semibold text-2xl leading-[1.2] tracking-[-0.03em] md:text-[26px]">
        {preview.contractTitle}
      </h1>
      <p className="mt-2 text-ink-muted text-sm tabular-nums">
        <Emphasis
          strong={terms.amount}
          text={
            terms.from
              ? `${terms.amount} ${m.home_dot_after({ text: terms.from })}`
              : terms.amount
          }
        />
      </p>
      <p className="mt-1 text-ink-muted text-sm">
        <Emphasis strong={role} text={m.invite_role({ role })} />
      </p>
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
      <InviteInfoList rows={howRows()} title={m.invite_guest_how_title()} />
      <InviteBar>
        <Button asChild size="lg" variant="secondary">
          <Link
            search={{ redirect: invitePath(token), mode: "signup" }}
            to="/login"
          >
            {m.invite_guest_signup()}
          </Link>
        </Button>
        <SignInLink token={token} />
      </InviteBar>
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
        <InviteBar>
          <Button asChild className="flex-1" size="lg">
            <a href={ask} rel="noopener noreferrer" target="_blank">
              <WhatsappLogo aria-hidden="true" size={18} />
              {m.invite_ask_whatsapp()}
            </a>
          </Button>
        </InviteBar>
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
      <InviteBar>
        <SignInLink token={token} />
      </InviteBar>
    </>
  );
}

/**
 * /invites/$token without a session (owner's decision 12): the public
 * preview, in the invite's frame without the stage (planner's decision 43)
 * and without the ✕ (H1: there is no app behind it yet).
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
  return (
    <StepFrame
      align="center"
      header={<StepHeader brand title={m.invite_rail_group()} />}
      rail={
        <InviteRail
          accepted={preview.status === "accepted"}
          inviterName={preview.inviterName}
        />
      }
    >
      {preview.status === "pending" && preview.terms ? (
        <GuestPending preview={preview} terms={preview.terms} token={token} />
      ) : (
        <GuestEnded preview={preview} token={token} />
      )}
    </StepFrame>
  );
}
