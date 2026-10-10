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
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, MenuItem } from "@/components/ui/menu";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Tag } from "@/components/ui/tag";
import { useCopy } from "@/hooks/use-copy";
import { MD_UP, useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
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

/** The role as plain text (mockup 20, B5): the arrow and the word, at the start of the meta, never a bordered tag. */
function RoleText({ role }: { role: NonNullable<PersonRowView["role"]> }) {
  const RoleIcon = ROLE_ICON[role.icon];
  return (
    <span className="inline-flex items-center gap-1 font-medium text-ink">
      <RoleIcon aria-hidden="true" size={13} />
      {role.text}
    </span>
  );
}

/**
 * The e-mail and since-when: one line from md ("rafa@… · no contrato desde
 * 30/06", cut at the end); below md each on its own line, the e-mail cut with
 * an ellipsis (whole in its title) instead of broken mid-word. The separator
 * stays for a screen reader there.
 */
function PersonMeta({
  meta,
  role,
}: {
  meta: PersonRowView["meta"];
  role: PersonRowView["role"];
}) {
  return (
    <p className="text-[12.5px] text-ink-muted md:truncate">
      {role ? <RoleText role={role} /> : null}
      {role && meta ? (
        <span className="max-md:sr-only"> {m.contract_sep()} </span>
      ) : null}
      {meta?.email ? (
        <span className="block truncate md:inline" title={meta.email}>
          {meta.email}
        </span>
      ) : null}
      {meta?.email && meta.note ? (
        <span className="max-md:sr-only"> {m.contract_sep()} </span>
      ) : null}
      {meta?.note ? <span className="block md:inline">{meta.note}</span> : null}
    </p>
  );
}

/** A 44 px action of the phone's sheet (the same look as a floating menu's item). */
function SheetAction({
  children,
  icon: ActionIcon,
  onClick,
  tone,
}: {
  children: string;
  icon: Icon;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      className={cn(
        "flex h-11 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm transition-colors hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        tone === "danger" ? "text-danger" : "text-ink"
      )}
      onClick={onClick}
      type="button"
    >
      <ActionIcon aria-hidden="true" size={18} />
      {children}
    </button>
  );
}

/** The owner's "⋮": a floating menu from md, a bottom sheet with the person's face on a phone. */
function RowMenu({
  contractId,
  person,
  view,
}: {
  contractId: string;
  person: ContractParticipant;
  view: PersonRowView;
}) {
  const copy = useCopy();
  const remove = useRemoveParticipantMutation(contractId);
  const [confirming, setConfirming] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const wide = useMediaQuery(MD_UP);
  const menuRef = useRef<HTMLButtonElement>(null);
  const inviteUrl = person.invite?.url ?? null;
  const copyLink = view.actions.includes("copy_link");

  return (
    <>
      {wide ? (
        <Menu
          label={m.people_row_actions({ name: person.displayName })}
          trigger={
            <IconButton
              icon={DotsThreeVertical}
              label={m.people_row_actions({ name: person.displayName })}
              ref={menuRef}
            />
          }
        >
          {copyLink && inviteUrl ? (
            <MenuItem
              icon={Link}
              onSelect={() => copy(inviteUrl, m.people_link_copied())}
            >
              {m.people_copy_link()}
            </MenuItem>
          ) : null}
          {view.removable ? (
            <MenuItem
              icon={UserMinus}
              onSelect={() => setConfirming(true)}
              tone="danger"
            >
              {m.people_remove()}
            </MenuItem>
          ) : null}
        </Menu>
      ) : (
        <>
          <IconButton
            icon={DotsThreeVertical}
            label={m.people_row_actions({ name: person.displayName })}
            onClick={() => setSheetOpen(true)}
            ref={menuRef}
          />
          <ResponsiveSheet
            leading={<PersonAvatar name={person.displayName} size="lg" />}
            onOpenChange={setSheetOpen}
            open={sheetOpen}
            title={person.displayName}
          >
            <div className="px-2 pt-2 pb-3">
              {copyLink && inviteUrl ? (
                <SheetAction
                  icon={Link}
                  onClick={() => {
                    copy(inviteUrl, m.people_link_copied());
                    setSheetOpen(false);
                  }}
                >
                  {m.people_copy_link()}
                </SheetAction>
              ) : null}
              {view.removable ? (
                <SheetAction
                  icon={UserMinus}
                  onClick={() => {
                    setSheetOpen(false);
                    setConfirming(true);
                  }}
                  tone="danger"
                >
                  {m.people_remove()}
                </SheetAction>
              ) : null}
            </div>
          </ResponsiveSheet>
        </>
      )}
      <ConfirmDialog
        cancelLabel={m.contract_cancel()}
        confirmLabel={m.people_remove_confirm()}
        description={m.people_remove_description({
          name: person.displayName,
        })}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          menuRef.current?.focus();
        }}
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
  );
}

/**
 * One person in Pessoas (mockup 20, B5): the face, the name with its state tag, the
 * role as text and the e-mail and since-when under it, "Reenviar" as the
 * only visible action (a pending invite's) and the owner's "⋮" with the rest. On a phone the role's tag
 * joins the name's line, so the e-mail has the whole width (cut with an
 * ellipsis, never broken mid-word) and since-when goes under it; the actions
 * drop to a line of their own.
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
  const resend = useResendInviteMutation(contractId);
  const inviteUrl = person.invite?.url ?? null;
  const hasMenu =
    view.removable ||
    (view.actions.includes("copy_link") && inviteUrl !== null);
  // Keeps the role tags on one edge between the removable rows and the owner's.
  const ownerSpacer =
    viewerIsOwner && !hasMenu ? (
      <span aria-hidden="true" className="size-9 shrink-0 max-md:hidden" />
    ) : null;

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
        {view.meta || view.role ? (
          <PersonMeta meta={view.meta} role={view.role} />
        ) : null}
      </div>
      {view.actions.includes("resend") ? (
        <div className="flex items-center gap-1 max-md:order-last max-md:basis-full max-md:pl-[54px]">
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
        </div>
      ) : null}
      {hasMenu ? (
        <RowMenu contractId={contractId} person={person} view={view} />
      ) : null}
      {ownerSpacer}
    </li>
  );
}
