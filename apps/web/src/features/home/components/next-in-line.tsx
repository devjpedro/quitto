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
import { useId } from "react";
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

/** How many of the other actions get a line; the rest is "+ N em Parcelas". */
export const SEQUENCE_MAX = 4;

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
  const body = (
    <>
      <IconTile icon={icon} tone={tileTone} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-sm">
          {view.title}
          {view.sequence && action.kind !== "invite" && action.count === 1 ? (
            <span className="font-normal text-ink-muted">
              {" "}
              {m.home_dot_after({ text: view.sequence })}
            </span>
          ) : null}
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
              <PersonText line={view.person} strong="text-ink" />
            </>
          ) : null}
        </span>
      </span>
      {action.kind === "invite" ? null : (
        <Money
          cents={view.amountCents ?? action.totalCents}
          className={cn(
            "shrink-0",
            action.direction === "receive" ? "text-brand" : "text-ink"
          )}
          sign={sign}
          size="list"
        />
      )}
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
 * a line each and no button (a tap opens it), up to four, then "+ N em
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
  const shown = actions.slice(0, SEQUENCE_MAX);
  const more = actions.length - shown.length;
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
      <ul className="divide-y divide-divider">
        {shown.map((action) => (
          <li key={action.id}>
            <SequenceRow action={action} locale={locale} today={today} />
          </li>
        ))}
      </ul>
      {more > 0 ? (
        <Link
          className="block border-divider border-t px-4 py-3 text-ink-muted text-sm transition-colors hover:bg-surface-card-hover"
          search={{}}
          to="/installments"
        >
          {m.home_sequence_more({ count: more })}
        </Link>
      ) : null}
    </section>
  );
}
