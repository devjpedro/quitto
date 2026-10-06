import {
  ArrowDownLeft,
  ArrowUpRight,
  DotsThreeVertical,
  EnvelopeSimple,
  Eye,
  type Icon,
  Link,
  PaperPlaneTilt,
  UserMinus,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, MenuItem } from "@/components/ui/menu";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Tag } from "@/components/ui/tag";
import { useCopy } from "@/hooks/use-copy";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { useRemoveParticipantMutation, useResendInviteMutation } from "../api";
import { type PersonRowView, personRowView } from "../lib/people-view";
import type { ContractParticipant } from "../types";

const ROLE_ICON: Record<NonNullable<PersonRowView["role"]>["icon"], Icon> = {
  receive: ArrowDownLeft,
  pay: ArrowUpRight,
  watch: Eye,
};

/**
 * One person in Pessoas (mockup 14): the face, the name with its tag, the
 * e-mail and since-when under it, the invite's actions (the owner's), the
 * role as a tag and the owner's "⋯" to remove. On a phone the actions drop to
 * a second line.
 */
export function PersonRow({
  contractId,
  person,
  viewerIsOwner,
}: {
  contractId: string;
  person: ContractParticipant;
  viewerIsOwner: boolean;
}) {
  const view = personRowView(person, { viewerIsOwner, locale: getLocale() });
  const copy = useCopy();
  const resend = useResendInviteMutation(contractId);
  const remove = useRemoveParticipantMutation(contractId);
  const [confirming, setConfirming] = useState(false);
  const RoleIcon = view.role ? ROLE_ICON[view.role.icon] : null;
  const inviteUrl = person.invite?.url ?? null;

  return (
    <li className="flex min-h-[68px] items-center gap-3.5 py-2.5 pr-4 pl-3 max-md:flex-wrap">
      <PersonAvatar name={person.displayName} self={person.isMe} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate font-medium text-sm">
            {person.displayName}
          </span>
          {view.tag ? (
            <Tag tone={view.tag.tone}>
              {view.tag.icon === "envelope" ? (
                <EnvelopeSimple aria-hidden="true" size={12.5} />
              ) : null}
              {view.tag.text}
            </Tag>
          ) : null}
        </div>
        {view.meta ? (
          <p className="text-[12.5px] text-ink-muted md:truncate">
            {view.meta}
          </p>
        ) : null}
      </div>
      {view.actions.length > 0 ? (
        <div className="flex items-center gap-1 max-md:order-last max-md:basis-full max-md:pl-[54px]">
          {view.actions.includes("resend") ? (
            <Button
              aria-label={m.people_resend_label()}
              disabled={resend.isPending}
              onClick={() => resend.mutate(person.id)}
              size="sm"
              variant="inset"
            >
              <PaperPlaneTilt aria-hidden="true" size={16} />
              {m.people_resend()}
            </Button>
          ) : null}
          {view.actions.includes("copy_link") && inviteUrl ? (
            <IconButton
              icon={Link}
              label={m.people_copy_link()}
              onClick={() => copy(inviteUrl, m.people_link_copied())}
            />
          ) : null}
        </div>
      ) : null}
      {view.role && RoleIcon ? (
        <span className="flex md:w-[116px] md:justify-end">
          <Tag>
            <RoleIcon aria-hidden="true" size={12.5} />
            {view.role.text}
          </Tag>
        </span>
      ) : null}
      {view.removable ? (
        <>
          <Menu
            label={m.people_row_actions({ name: person.displayName })}
            trigger={
              <IconButton
                icon={DotsThreeVertical}
                label={m.people_row_actions({ name: person.displayName })}
              />
            }
          >
            <MenuItem
              icon={UserMinus}
              onSelect={() => setConfirming(true)}
              tone="danger"
            >
              {m.people_remove()}
            </MenuItem>
          </Menu>
          <ConfirmDialog
            cancelLabel={m.contract_cancel()}
            confirmLabel={m.people_remove_confirm()}
            description={m.people_remove_description({
              name: person.displayName,
            })}
            onConfirm={() =>
              remove.mutate(person.id, {
                onSuccess: () => setConfirming(false),
              })
            }
            onOpenChange={setConfirming}
            open={confirming}
            pending={remove.isPending}
            title={m.people_remove_title({ name: person.displayName })}
            tone="danger"
          />
        </>
      ) : null}
    </li>
  );
}
