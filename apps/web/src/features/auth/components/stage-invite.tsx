import { Check, LockSimple } from "@phosphor-icons/react";
import { rise } from "@/components/stage/stage-panel";
import { DateTile } from "@/components/ui/date-tile";
import { Emphasis } from "@/components/ui/emphasis";
import { Money } from "@/components/ui/money";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Tag } from "@/components/ui/tag";
import type { PublicInvitePreview } from "@/features/invites/api";
import { firstName, roleLabel } from "@/features/invites/lib/invite-format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { monthlyDates, STAGE_ROWS } from "../lib/invite-stage";

/** The invite as the invitee will see it, in white over the showcase (mockup 19, A4): who, what, and the first installments. */
export function InvitePiece({
  preview,
  terms,
}: {
  preview: PublicInvitePreview;
  terms: NonNullable<PublicInvitePreview["terms"]>;
}) {
  const locale = getLocale();
  const dates =
    terms.firstDueDate && terms.amountCents !== null
      ? monthlyDates(
          terms.firstDueDate,
          Math.min(terms.installmentsCount, STAGE_ROWS)
        )
      : [];
  const role = roleLabel(preview.role);
  return (
    <div
      className="piece-shadow piece-rise w-[400px] rounded-panel bg-surface px-[22px] pt-5 pb-[22px] text-ink"
      style={rise(0)}
    >
      <Tag tone="highlight">{m.auth_stage_invite_tag()}</Tag>
      <p className="mt-3.5 flex items-start gap-2 text-[13px] text-ink-muted leading-[1.35]">
        <PersonAvatar name={preview.inviterName} size="md" />
        <Emphasis
          className="pt-0.5"
          strong={preview.inviterName}
          text={m.auth_stage_invited_you({ name: preview.inviterName })}
        />
      </p>
      <p className="mt-2.5 font-display font-semibold text-2xl leading-[1.2] tracking-[-0.025em]">
        {preview.contractTitle}
      </p>
      <p className="mt-1.5 text-[13.5px] text-ink-muted">
        <Emphasis strong={role} text={m.invite_role({ role })} />
      </p>
      {dates.length > 0 && terms.amountCents !== null ? (
        <ul className="mt-4 divide-y divide-divider overflow-hidden rounded-card bg-surface-card">
          {dates.map((date, index) => (
            <li
              className="flex min-h-[52px] items-center gap-3 py-1.5 pr-3.5 pl-1.5"
              key={date}
            >
              <DateTile iso={date} locale={locale} />
              <span className="flex-1 font-medium text-sm">
                {m.auth_stage_installment({ n: index + 1 })}
              </span>
              <Money cents={terms.amountCents ?? 0} size="list" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function TrailMark({ state }: { state: "done" | "now" | "todo" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-[30px] shrink-0 items-center justify-center rounded-full",
        state === "done" && "bg-on-brand text-brand-surface",
        state === "now" && "shadow-[inset_0_0_0_2.5px_var(--highlight)]",
        state === "todo" && "border-2 border-on-brand-muted border-dashed"
      )}
    >
      {state === "done" ? <Check size={16} weight="bold" /> : null}
      {state === "now" ? (
        <span className="size-[11px] rounded-full bg-highlight" />
      ) : null}
    </span>
  );
}

/** The trail as the showcase's title (mockup 19, decision 5): ✓ who created · ● you respond · ○ together. */
export function InviteTrail({ preview }: { preview: PublicInvitePreview }) {
  const inviter = firstName(preview.inviterName);
  const item =
    "flex items-center gap-4 font-display font-semibold text-[30px] leading-[1.25] tracking-[-0.03em]";
  return (
    <>
      <ol
        aria-label={m.auth_stage_invite_tag()}
        className="flex flex-col gap-1"
      >
        <li className={item}>
          <TrailMark state="done" />
          {m.auth_stage_trail_created({ name: inviter })}
        </li>
        <li aria-current="step" className={item}>
          <TrailMark state="now" />
          {m.auth_stage_trail_respond()}
        </li>
        <li className={cn(item, "text-on-brand-muted")}>
          <TrailMark state="todo" />
          {m.auth_stage_trail_together()}
        </li>
      </ol>
      <p className="mt-[22px] flex items-center gap-2 text-on-brand-muted text-sm">
        <LockSimple aria-hidden="true" className="text-highlight" size={17} />
        {m.invite_rail_footer()}
      </p>
    </>
  );
}

/** On a phone the trail is three chips at the foot of the header (mockup 19, A4m). */
export function InviteChips({ preview }: { preview: PublicInvitePreview }) {
  const chip = "gap-1.5";
  return (
    <ol
      aria-label={m.auth_stage_invite_tag()}
      className="absolute inset-x-5 bottom-5 flex gap-1.5 lg:hidden"
    >
      <li>
        <Tag className={cn(chip, "bg-on-brand text-brand-surface")}>
          <Check aria-hidden="true" size={12} weight="bold" />
          {m.auth_stage_chip_created({ name: firstName(preview.inviterName) })}
        </Tag>
      </li>
      <li aria-current="step">
        <Tag tone="highlight">{m.auth_stage_chip_respond()}</Tag>
      </li>
      <li>
        <Tag className="bg-transparent text-on-brand-muted shadow-[inset_0_0_0_1px_var(--on-brand-muted)]">
          {m.auth_stage_chip_together()}
        </Tag>
      </li>
    </ol>
  );
}
