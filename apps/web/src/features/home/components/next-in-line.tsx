import {
  CalendarBlank,
  CalendarCheck,
  CaretRight,
  ChatText,
  Envelope,
  type Icon,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Locale } from "@quitto/shared";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useId, useState } from "react";
import { IconTile, type IconTileTone } from "@/components/ui/icon-tile";
import { Money } from "@/components/ui/money";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { PersonText } from "@/components/ui/person-text";
import type { TagTone } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { describeAction } from "../lib/action-view";
import type { HomeAction } from "../types";

/** How many of the other actions get a line; the rest is "+ N em Parcelas" or "Ver mais N". */
export const SEQUENCE_MAX = 3;

const STATUS_TEXT: Record<TagTone, string> = {
  neutral: "text-ink-muted",
  brand: "text-brand",
  highlight: "text-ink",
  warning: "text-warning",
  danger: "text-danger",
  ink: "text-ink",
  sunken: "text-ink-muted",
};

function tileOf(action: HomeAction, tone: TagTone): [Icon, IconTileTone] {
  if (action.kind === "invite") {
    return [Envelope, "brand"];
  }
  if (action.kind === "overdue" || action.kind === "disputed") {
    return [WarningCircle, "danger"];
  }
  if (action.kind === "review") {
    return [ChatText, "warning"];
  }
  return tone === "ink" ? [CalendarCheck, "ink"] : [CalendarBlank, "neutral"];
}

function SequenceRow({
  action,
  locale,
  today,
}: {
  action: HomeAction;
  locale: Locale;
  today: string;
}) {
  const view = describeAction(action, { first: false, locale, today });
  const [icon, tileTone] = tileOf(action, view.tone);
  const sign =
    action.kind !== "invite" && action.direction === "receive" ? "+" : "−";
  const money =
    action.kind === "invite" ? null : (
      <Money
        cents={view.amountCents ?? action.totalCents}
        className={action.direction === "receive" ? "text-brand" : "text-ink"}
        sign={sign}
        size="list"
      />
    );
  const body = (
    <>
      <IconTile icon={icon} tone={tileTone} />
      <span className="min-w-0 flex-1">
        {/* On a phone the amount sits on the title's line, so the meta keeps the whole width. */}
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate font-medium text-sm">
            {view.title}
            {view.sequence && action.kind !== "invite" && action.count === 1 ? (
              <span className="font-normal text-ink-muted max-md:hidden">
                {" "}
                {m.home_dot_after({ text: view.sequence })}
              </span>
            ) : null}
          </span>
          {money ? <span className="shrink-0 md:hidden">{money}</span> : null}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-muted">
          <span className={cn("shrink-0 font-medium", STATUS_TEXT[view.tone])}>
            {view.tag}
          </span>
          {view.person ? (
            <>
              <span aria-hidden="true">·</span>
              {view.person.name ? (
                <PersonAvatar name={view.person.name} />
              ) : null}
              <span className="min-w-[4.5rem] truncate">
                <PersonText line={view.person} strong="text-ink" />
              </span>
            </>
          ) : null}
        </span>
      </span>
      {money ? <span className="shrink-0 max-md:hidden">{money}</span> : null}
      <CaretRight
        aria-hidden="true"
        className="shrink-0 text-ink-muted"
        size={14}
      />
    </>
  );
  const className =
    "group/row flex min-h-16 items-center gap-3 rounded-[inherit] px-3 py-2.5 transition-colors hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset";
  return action.kind === "invite" ? (
    <Link
      className={className}
      params={{ token: action.token }}
      to="/invites/$token"
    >
      {body}
    </Link>
  ) : (
    <Link
      className={className}
      params={{ id: action.contractId }}
      search={{ installment: action.installmentId }}
      to="/contracts/$id"
    >
      {body}
    </Link>
  );
}

/**
 * "Na sequência" (mockup 20, B1): the actions after the one in the spotlight,
 * a line each and no button (a tap opens it), up to three (what fits the
 * natural height of the spotlight card, so no block is stretched), then "+ N em
 * Parcelas". Filled like the other blocks, with straight dividers.
 */
export function NextInLine({
  actions,
  today,
}: {
  actions: HomeAction[];
  today: string;
}) {
  const locale = getLocale();
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const tail = actions.slice(SEQUENCE_MAX);
  // Parcelas does not list invites: if one is left over, the rest expands in
  // place; if only installments are, "+ N em Parcelas" takes you there.
  const hasHiddenInvite = tail.some((action) => action.kind === "invite");
  const shown = expanded ? actions : actions.slice(0, SEQUENCE_MAX);
  const footerClass =
    "block w-full border-divider border-t px-4 py-3 text-left text-ink-muted text-sm transition-colors hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset";
  let footer: ReactNode = null;
  if (hasHiddenInvite) {
    footer = (
      <button
        aria-controls={listId}
        aria-expanded={expanded}
        className={footerClass}
        onClick={() => setExpanded((open) => !open)}
        type="button"
      >
        {expanded
          ? m.home_sequence_less()
          : m.home_sequence_expand({ count: tail.length })}
      </button>
    );
  } else if (tail.length > 0) {
    footer = (
      <Link className={footerClass} search={{}} to="/installments">
        {m.home_sequence_more({ count: tail.length })}
      </Link>
    );
  }
  return (
    <section
      aria-labelledby={titleId}
      className="overflow-hidden rounded-card bg-surface-card"
    >
      <div className="flex items-baseline justify-between px-4 pt-3.5 pb-1.5">
        <h2 className="font-semibold text-sm" id={titleId}>
          {m.home_sequence_title()}
        </h2>
        <span className="text-ink-muted text-sm tabular-nums">
          {actions.length}
        </span>
      </div>
      <ul className="divide-y divide-divider" id={listId}>
        {shown.map((action) => (
          <li key={action.id}>
            <SequenceRow action={action} locale={locale} today={today} />
          </li>
        ))}
      </ul>
      {footer}
    </section>
  );
}
