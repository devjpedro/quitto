import { LockSimple } from "@phosphor-icons/react";
import { StepRail } from "@/components/layout/step-rail";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { InviteView } from "../api";
import { dayOf, firstName, weekdayDate } from "../lib/invite-format";

/**
 * The invite's trail where the sidebar is (mockup 15, G1): who created →
 * you answer → together. `invitee` turns it into the owner's trail (H6);
 * without `createdAt` (the public preview) the first step has no date.
 */
export function InviteRail({
  createdAt,
  inviterName,
  invitee,
  status,
}: {
  createdAt?: string;
  inviterName: string;
  invitee?: string;
  status: InviteView["status"];
}) {
  const locale = getLocale();
  const inviter = firstName(inviterName);
  const answerer = invitee ? firstName(invitee) : null;
  const accepted = status === "accepted";
  // Declined or expired: the answer is in, and there is no "together" to follow.
  const closed = status === "declined" || status === "expired";
  const closedMeta =
    status === "declined" ? m.invite_rail_declined() : m.invite_rail_expired();
  return (
    <StepRail
      footer={
        answerer
          ? m.invite_rail_footer_owner({ name: answerer })
          : m.invite_rail_footer()
      }
      footerIcon={LockSimple}
      group={m.invite_rail_group()}
      order="label-first"
      steps={[
        {
          label: answerer
            ? m.invite_rail_created_by_you()
            : m.invite_rail_created({ name: inviter }),
          meta: createdAt ? weekdayDate(dayOf(createdAt), locale) : undefined,
          state: "done",
        },
        {
          label: answerer
            ? m.invite_rail_respond_other({ name: answerer })
            : m.invite_rail_respond(),
          meta: closed ? closedMeta : undefined,
          state: accepted || closed ? "done" : "next",
        },
        {
          label: m.invite_rail_together(),
          meta: m.invite_rail_together_hint(),
          state: accepted ? "next" : "todo",
        },
      ]}
    />
  );
}
