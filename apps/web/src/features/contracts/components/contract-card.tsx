import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  Hourglass,
  WarningCircle,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { InstallmentBar } from "@/components/ui/installment-bar";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Tag } from "@/components/ui/tag";
import { formatMoney, moneyParts } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { type CardTag, contractCardView } from "../lib/contract-card-view";
import type { ContractListItem } from "../types";

/** "R$ 3.840,00" with the "R$" set back (11.5 px, muted) so a long value fits whole. */
function RemainingMoney({ cents }: { cents: number }) {
  const locale = getLocale();
  const { currency, decimal, fraction, integer, sign } = moneyParts(
    cents,
    locale
  );
  return (
    <>
      <span className="sr-only">{formatMoney(cents, locale)}</span>
      <span aria-hidden="true">
        <span className="mr-0.5 text-[11.5px] text-ink-muted">{currency}</span>
        {sign}
        {integer}
        {decimal}
        {fraction}
      </span>
    </>
  );
}

const TAG_ICON = {
  check: CheckCircle,
  overdue: WarningCircle,
  review: Hourglass,
} as const;

function StateTag({ tag }: { tag: CardTag }) {
  const IconComponent = tag.icon ? TAG_ICON[tag.icon] : null;
  return (
    <Tag className="self-center" tone={tag.tone}>
      {IconComponent ? (
        <IconComponent aria-hidden="true" size={12} weight="bold" />
      ) : null}
      {tag.label}
    </Tag>
  );
}

/**
 * One contract (mockup 20, B4): the title, the other party, the % with
 * "falta R$ X" and the direction's arrow beside it, the segmented bar and the
 * installment of the moment with its state at the foot. A filled card (never
 * outlined) that is a link as a whole. Only a contract you follow keeps a
 * role tag: there is no arrow to say it.
 */
export function ContractCard({
  item,
  today,
}: {
  item: ContractListItem;
  today: string;
}) {
  const locale = getLocale();
  const view = contractCardView(item, today, locale);
  const RoleArrow = item.direction === "receive" ? ArrowDownLeft : ArrowUpRight;
  return (
    <Link
      className="flex flex-col gap-3 rounded-card bg-surface-card p-4 transition-[background-color,transform] hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-[.97] motion-reduce:active:scale-100"
      data-testid={`contract-card-${item.id}`}
      params={{ id: item.id }}
      to="/contracts/$id"
    >
      <div className="flex flex-col gap-1.5">
        {item.direction === null ? (
          <Tag tone={view.role.tone}>{view.role.label}</Tag>
        ) : null}
        <h2 className="truncate font-display font-semibold text-[17px] leading-tight tracking-[-0.02em]">
          {item.title}
        </h2>
        {item.direction === null ? null : (
          <div className="flex min-h-6 items-center gap-2 font-medium text-sm">
            {item.counterpartyName ? (
              <>
                <PersonAvatar name={item.counterpartyName} />
                <span className="truncate">{item.counterpartyName}</span>
              </>
            ) : (
              <span className="text-ink-muted">{m.contracts_no_party()}</span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-1.5">
          <span className="font-display font-medium text-[32px] tabular-nums leading-none tracking-[-0.03em]">
            {view.percent}
            <span className="text-[0.55em] tracking-normal">%</span>
          </span>
          <span className="text-ink-muted text-xs">{view.percentLabel}</span>
        </span>
        <span className="flex items-baseline gap-1.5 font-medium text-sm tabular-nums">
          {item.direction === null ? null : (
            <>
              <RoleArrow
                aria-hidden="true"
                className="self-center text-brand"
                size={13}
                weight="bold"
              />
              <span className="sr-only">{view.role.label}.</span>
            </>
          )}
          <span className="font-normal text-ink-muted">
            {view.remaining.label.toLowerCase()}
          </span>
          <RemainingMoney cents={view.remaining.cents} />
        </span>
      </div>
      <InstallmentBar
        installmentsCount={item.installmentsCount}
        overdueCount={item.overdueCount}
        paidCount={item.paidCount}
        statuses={item.statuses}
      />
      <div className="flex min-h-6 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12.5px] text-ink-muted tabular-nums">
          {view.footer}
        </span>
        <span className="flex shrink-0 gap-1">
          {view.tags.map((tag) => (
            <StateTag key={tag.label} tag={tag} />
          ))}
        </span>
      </div>
    </Link>
  );
}
