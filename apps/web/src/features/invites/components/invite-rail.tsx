import { LockSimple } from "@phosphor-icons/react";
import { StepRail } from "@/components/layout/step-rail";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { dayOf, firstName, weekdayDate } from "../lib/invite-format";

/**
 * The invite's trail where the sidebar is (mockup 15, G1): who created →
 * you answer → together. `invitee` turns it into the owner's trail (H6);
 * without `createdAt` (the public preview) the first step has no date.
 */
export function InviteRail({
  accepted = false,
  createdAt,
  inviterName,
  invitee,
}: {
  accepted?: boolean;
  createdAt?: string;
  inviterName: string;
  invitee?: string;
}) {
  const locale = getLocale();
  const inviter = firstName(inviterName);
  const answerer = invitee ? firstName(invitee) : null;
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
          state: accepted ? "done" : "next",
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
