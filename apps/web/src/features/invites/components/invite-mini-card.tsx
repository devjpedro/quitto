import { todayISO } from "@quitto/shared";
import type { ReactNode } from "react";
import { SideTag } from "@/components/preview/preview-parts";
import { Emphasis } from "@/components/ui/emphasis";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { inviteTerms } from "@/lib/invite-terms-text";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { InviteView } from "../api";
import { sideOfRole } from "../lib/invite-preview-model";

/**
 * What the invite was, below 1140 (mockup 15, H): the name, the side (or
 * the owner's status tag), the person with a face and the terms. Beside the
 * stage (≥ 1140) the preview already shows it (planner's decision 35).
 */
export function InviteMiniCard({
  always = false,
  person,
  tag,
  terms,
  view,
}: {
  /** The owner's screen has no stage (I19 of the plan review): the mini card at every width. */
  always?: boolean;
  person: { name: string; strong: string; text: string };
  tag?: ReactNode;
  terms?: string;
  view: InviteView;
}) {
  // Null terms (another account, invite ended): no condition line to draw.
  const phrase = view.terms
    ? inviteTerms(view.terms, todayISO(), getLocale())
    : null;
  const text = phrase?.from
    ? `${phrase.amount} ${m.home_dot_after({ text: phrase.from })}`
    : phrase?.amount;
  return (
    <div
      className={cn(
        "mt-[18px] rounded-card bg-surface-card px-4 pt-3.5 pb-4",
        !always && "stage:hidden"
      )}
      data-testid="invite-mini"
    >
      <div className="flex items-center justify-between gap-2">
        <b className="min-w-0 truncate font-semibold text-sm">
          {view.contract.title}
        </b>
        {tag ?? <SideTag side={sideOfRole(view.role)} />}
      </div>
      <p className="mt-2 flex min-w-0 items-center gap-2 text-[13px] text-ink-muted">
        <PersonAvatar name={person.name} />
        <Emphasis
          className="min-w-0 truncate"
          strong={person.strong}
          text={person.text}
        />
      </p>
      {terms || phrase ? (
        <p className="mt-1.5 text-[13px] text-ink-muted tabular-nums">
          {terms ??
            (phrase ? (
              <Emphasis strong={phrase.amount} text={text ?? phrase.amount} />
            ) : null)}
        </p>
      ) : null}
    </div>
  );
}
