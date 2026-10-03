import { InstallmentBar } from "@/components/ui/installment-bar";
import { Money } from "@/components/ui/money";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { ActionView, PersonLine } from "../lib/action-view";
import type { InstallmentAction } from "../types";

/** The person's line with the name in bold; the message puts the name in verbatim. */
export function PersonText({
  line,
  strong,
  wrap = false,
}: {
  line: PersonLine;
  strong: string;
  wrap?: boolean;
}) {
  const at = line.name ? line.text.indexOf(line.name) : -1;
  const fit = wrap ? "min-w-0" : "min-w-0 truncate";
  if (!line.name || at < 0) {
    return <span className={fit}>{line.text}</span>;
  }
  return (
    <span className={fit}>
      {line.text.slice(0, at)}
      <b className={cn("font-medium", strong)}>{line.name}</b>
      {line.text.slice(at + line.name.length)}
    </span>
  );
}

/**
 * An installment card's body (mockup 13): the contract and its installment
 * numbers, the amount, the other party with a face, and the whole contract
 * on a bar with its legend.
 */
export function InstallmentBody({
  action,
  first,
  titleId,
  view,
}: {
  action: InstallmentAction;
  first: boolean;
  titleId: string;
  view: ActionView;
}) {
  const muted = first ? "text-on-brand-muted" : "text-ink-muted";
  const strong = first ? "text-on-brand" : "text-ink";
  return (
    <>
      <p className="mt-3.5 truncate font-medium text-sm" id={titleId}>
        {view.title}
        {view.sequence ? (
          <>
            {" "}
            <span className={cn("font-normal", muted)}>
              {m.home_dot_after({ text: view.sequence })}
            </span>
          </>
        ) : null}
      </p>
      <Money
        cents={view.amountCents ?? action.totalCents}
        className="mt-0.5 block"
        size="card"
      />
      {view.person ? (
        <p
          className={cn(
            "mt-2 flex min-w-0 items-center gap-2 text-[13px]",
            muted
          )}
        >
          {view.person.name ? <PersonAvatar name={view.person.name} /> : null}
          <PersonText line={view.person} strong={strong} />
        </p>
      ) : null}
      {view.legend ? (
        <div className="mt-4">
          <InstallmentBar
            installmentsCount={action.installmentsCount}
            onBrand={first}
            overdueCount={action.contract.overdueCount}
            paidCount={action.contract.paidCount}
            statuses={action.contract.statuses}
          />
          {/* Each half on one line; in a narrow card (1024 px) the second
              wraps to the right instead of spilling past the card. */}
          <p
            className={cn(
              "mt-2 flex flex-wrap justify-between gap-x-2 whitespace-nowrap text-xs tabular-nums",
              muted
            )}
          >
            <span>{view.legend.done}</span>
            <span className={cn("ml-auto font-medium", strong)}>
              {view.legend.remaining}
            </span>
          </p>
        </div>
      ) : null}
    </>
  );
}

/** An invite card's body (mockup 13): who invited, with a 28 px face; the contract; the terms. */
export function InviteBody({
  first,
  titleId,
  view,
}: {
  first: boolean;
  titleId: string;
  view: ActionView;
}) {
  const muted = first ? "text-on-brand-muted" : "text-ink-muted";
  const strong = first ? "text-on-brand" : "text-ink";
  return (
    <>
      {view.person ? (
        <p
          className={cn(
            "mt-3.5 flex items-start gap-2 text-[13px] leading-snug",
            muted
          )}
        >
          {view.person.name ? (
            <PersonAvatar name={view.person.name} size="md" />
          ) : null}
          <span className="pt-px">
            <PersonText line={view.person} strong={strong} wrap />
          </span>
        </p>
      ) : null}
      <p
        className="mt-3 font-display font-semibold text-[22px] leading-tight tracking-[-0.025em]"
        id={titleId}
      >
        {view.title}
      </p>
      {view.terms ? (
        <p className={cn("mt-1.5 text-[13px]", muted)}>
          <b className={cn("font-medium tabular-nums", strong)}>
            {view.terms.amount}
          </b>
          {view.terms.from ? (
            <> {m.home_dot_after({ text: view.terms.from })}</>
          ) : null}
        </p>
      ) : null}
    </>
  );
}
