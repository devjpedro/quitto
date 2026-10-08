import {
  CheckCircle,
  ClockCountdown,
  Info,
  UserSwitch,
  WhatsappLogo,
  XCircle,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Emphasis } from "@/components/ui/emphasis";
import { whatsappUrl } from "@/features/installments/lib/whatsapp-message";
import { useIdentity } from "@/hooks/use-identity";
import { clearIdentityCookie } from "@/hooks/use-identity-cookie";
import { signOut } from "@/lib/auth-client";
import { formatDate } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { InviteView } from "../api";
import { dayOf, firstName, timeOf, weekdayDate } from "../lib/invite-format";
import { InviteBar } from "./invite-bar";
import { InviteMiniCard } from "./invite-mini-card";
import { StateHeading } from "./state-heading";

export type StatusKind =
  | "accepted"
  | "declined"
  | "expired"
  | "otherAccount"
  | "participant";

function GoNow({ primary = false }: { primary?: boolean }) {
  return (
    <Button
      asChild
      className={primary ? "w-full" : "flex-1"}
      size="lg"
      variant={primary ? "primary" : "secondary"}
    >
      <Link to="/">{m.invite_go_now()}</Link>
    </Button>
  );
}

function OpenContract({ view }: { view: InviteView }) {
  return (
    <Button asChild className="flex-1" size="lg">
      <Link params={{ id: view.contractId }} search={{}} to="/contracts/$id">
        {m.invite_open_contract()}
      </Link>
    </Button>
  );
}

/** Signs out and comes back to this invite on the login screen (the old page did the same). */
async function switchAccount(token: string) {
  await signOut();
  clearIdentityCookie();
  window.location.href = `/login?redirect=${encodeURIComponent(`/invites/${token}`)}`;
}

/**
 * The ended states and the wrong account (mockup 15, H3, H4, H5, H7): what
 * the invite was (the mini card, below 1140) and the next useful step.
 */
export function InviteStatus({
  kind,
  token,
  view,
}: {
  kind: StatusKind;
  token: string;
  view: InviteView;
}) {
  const locale = getLocale();
  const identity = useIdentity();
  const inviter = firstName(view.inviterName);
  const mini = (
    <InviteMiniCard
      always={view.terms === null}
      person={{
        name: view.inviterName,
        strong: view.inviterName,
        text: m.invite_from_line({ name: view.inviterName }),
      }}
      view={view}
    />
  );
  if (kind === "accepted" || kind === "participant") {
    return (
      <>
        <StateHeading
          icon={CheckCircle}
          title={
            kind === "accepted"
              ? m.invite_accepted_title()
              : m.invite_participant_title()
          }
          tone="brand"
        >
          {kind === "accepted" && view.acceptedAt
            ? m.invite_accepted_when({
                date: formatDate(dayOf(view.acceptedAt), locale, "dayMonth"),
                time: timeOf(view.acceptedAt, locale),
              })
            : null}
        </StateHeading>
        {mini}
        <InviteBar>
          <GoNow />
          <OpenContract view={view} />
        </InviteBar>
      </>
    );
  }
  if (kind === "expired") {
    const ask = whatsappUrl([
      m.invite_whatsapp_message({ name: inviter, title: view.contract.title }),
    ]);
    return (
      <>
        <StateHeading
          icon={ClockCountdown}
          title={m.invite_expired_title()}
          tone="warning"
        >
          {m.invite_expired_text({
            date: weekdayDate(dayOf(view.expiresAt), locale),
            name: inviter,
          })}
        </StateHeading>
        {mini}
        <InviteBar>
          <GoNow />
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
  if (kind === "declined") {
    return (
      <>
        <StateHeading
          icon={XCircle}
          title={m.invite_declined_title()}
          tone="neutral"
        >
          {m.invite_declined_text({
            date: formatDate(
              dayOf(view.declinedAt ?? view.sentAt),
              locale,
              "dayMonth"
            ),
            name: inviter,
          })}
        </StateHeading>
        {mini}
        <p className="mt-4 flex items-start gap-2 text-[13px] text-ink-muted leading-[1.45]">
          <Info aria-hidden="true" className="mt-px shrink-0" size={16} />
          {m.invite_declined_note({ name: inviter })}
        </p>
        <InviteBar>
          <GoNow primary />
        </InviteBar>
      </>
    );
  }
  const masked = view.emailMasked;
  const signedAs = identity?.email ?? "";
  return (
    <>
      <StateHeading
        icon={UserSwitch}
        title={m.invite_other_title()}
        tone="warning"
      >
        <Emphasis
          strong={masked}
          text={m.invite_other_text({ masked, email: signedAs })}
        />
      </StateHeading>
      {mini}
      <InviteBar>
        <GoNow />
        <Button
          className="flex-1"
          onClick={() => switchAccount(token)}
          size="lg"
        >
          {m.invite_switch_account()}
        </Button>
      </InviteBar>
    </>
  );
}
