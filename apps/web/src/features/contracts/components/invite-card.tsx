import { PaperPlaneTilt, UserPlus } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { IconTile } from "@/components/ui/icon-tile";
import { m } from "@/paraglide/messages.js";
import { useSendInviteMutation } from "../api";
import type { ContractParticipant } from "../types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The empty state of a person known only by name (mockup 14, F3): dashed,
 * with what the invite brings them and the e-mail field to send it.
 */
export function InviteCard({
  contractId,
  participant,
  pays,
}: {
  contractId: string;
  participant: ContractParticipant;
  pays: boolean;
}) {
  const send = useSendInviteMutation(contractId);
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);
  const name = participant.displayName.split(" ")[0] ?? participant.displayName;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setInvalid(true);
      return;
    }
    send.mutate({ participantId: participant.id, email: value });
  };

  return (
    <section
      aria-labelledby="invite-card-title"
      className="mt-3 flex gap-4 rounded-card border-[1.5px] border-line-strong border-dashed p-[18px] max-md:flex-col"
      data-testid="invite-card"
    >
      <IconTile className="bg-surface-card" icon={UserPlus} tone="neutral" />
      <div className="min-w-0 flex-1">
        <h3
          className="font-display font-semibold text-[17px] tracking-[-0.02em]"
          id="invite-card-title"
        >
          {m.people_invite_card_title({ name })}
        </h3>
        <p className="mt-1 text-[13px] text-ink-muted leading-[1.45]">
          {pays
            ? m.people_invite_card_pays({ name })
            : m.people_invite_card_receives({ name })}
        </p>
        <form
          className="mt-3.5 flex items-start gap-2.5 max-md:flex-col"
          noValidate
          onSubmit={submit}
        >
          <TextField
            autoComplete="email"
            className="min-w-0 flex-1 max-md:w-full"
            error={invalid ? m.people_email_invalid() : undefined}
            id="invite-email"
            label={m.people_email()}
            onChange={(event) => {
              setEmail(event.target.value);
              setInvalid(false);
            }}
            type="email"
            value={email}
          />
          <Button
            className="max-md:w-full md:mt-[29px]"
            disabled={send.isPending}
            type="submit"
          >
            <PaperPlaneTilt aria-hidden="true" size={16} />
            {m.people_send_invite()}
          </Button>
        </form>
      </div>
    </section>
  );
}
