import {
  CheckCircle,
  ClockCountdown,
  EnvelopeSimple,
  HourglassMedium,
  type Icon,
  LinkSimple,
  PaperPlaneTilt,
  XCircle,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tag, type TagTone } from "@/components/ui/tag";
import { formatDate } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { type InviteView, useResendInvite } from "../api";
import { dayOf, firstName, weekdayDate } from "../lib/invite-format";
import { InviteBar } from "./invite-bar";
import { InviteMiniCard } from "./invite-mini-card";
import { StateHeading } from "./state-heading";

const STATUS: Record<
  InviteView["status"],
  { icon: Icon; label: () => string; tone: TagTone }
> = {
  pending: {
    icon: HourglassMedium,
    label: () => m.invite_status_pending(),
    tone: "warning",
  },
  accepted: {
    icon: CheckCircle,
    label: () => m.invite_status_accepted(),
    tone: "brand",
  },
  declined: {
    icon: XCircle,
    label: () => m.invite_status_declined(),
    tone: "neutral",
  },
  expired: {
    icon: ClockCountdown,
    label: () => m.invite_status_expired(),
    tone: "neutral",
  },
};

function ownerText(
  view: InviteView,
  locale: ReturnType<typeof getLocale>
): string {
  const name = firstName(view.inviteeName ?? view.emailMasked);
  if (view.status === "accepted" && view.acceptedAt) {
    return m.invite_owner_accepted({
      name,
      date: formatDate(dayOf(view.acceptedAt), locale, "dayMonth"),
    });
  }
  if (view.status === "declined" && view.declinedAt) {
    return m.invite_owner_declined({
      name,
      date: formatDate(dayOf(view.declinedAt), locale, "dayMonth"),
    });
  }
  if (view.status === "expired") {
    return m.invite_owner_expired({
      date: weekdayDate(dayOf(view.expiresAt), locale),
    });
  }
  return m.invite_owner_pending({ name });
}

/** The invite opened by who sent it (mockup 15, H6): its status, the link to copy, the e-mail to resend (same link). */
export function OwnerInvite({
  token,
  view,
}: {
  token: string;
  view: InviteView;
}) {
  const locale = getLocale();
  const resend = useResendInvite(view, token);
  const invitee = view.inviteeName ?? view.emailMasked;
  const status = STATUS[view.status];
  const canResend = view.status === "pending" || view.status === "expired";
  const copy = async () => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/invites/${token}`
    );
    toast.success(m.invite_link_copied());
  };
  const forText = m.invite_for({ name: invitee });
  return (
    <>
      <StateHeading
        icon={PaperPlaneTilt}
        title={m.invite_owner_title()}
        tone="brand"
      >
        {ownerText(view, locale)}
      </StateHeading>
      <InviteMiniCard
        always
        person={{
          name: invitee,
          strong: invitee,
          text: view.email
            ? `${forText} ${m.home_dot_after({ text: view.email })}`
            : forText,
        }}
        tag={
          <Tag tone={status.tone}>
            <status.icon aria-hidden="true" size={12} weight="bold" />
            {status.label()}
          </Tag>
        }
        terms={
          // Expired: the title already says until when it was valid (once per screen).
          view.status === "expired"
            ? m.invite_sent_only({
                date: formatDate(dayOf(view.sentAt), locale, "dayMonth"),
              })
            : m.invite_sent_line({
                date: formatDate(dayOf(view.sentAt), locale, "dayMonth"),
                until: formatDate(dayOf(view.expiresAt), locale, "dayMonth"),
              })
        }
        view={view}
      />
      <div className="mt-3.5 flex gap-2.5">
        <Button className="min-w-0 flex-1" onClick={copy} variant="secondary">
          <LinkSimple aria-hidden="true" size={17} />
          {m.invite_copy_link()}
        </Button>
        {canResend ? (
          <Button
            className="min-w-0 flex-1"
            disabled={resend.isPending}
            onClick={() => resend.mutate()}
            variant="secondary"
          >
            <EnvelopeSimple aria-hidden="true" size={17} />
            {m.invite_resend()}
          </Button>
        ) : null}
      </div>
      <InviteBar>
        <Button asChild block size="lg">
          <Link
            params={{ id: view.contractId }}
            search={{}}
            to="/contracts/$id"
          >
            {m.invite_open_contract()}
          </Link>
        </Button>
      </InviteBar>
    </>
  );
}
