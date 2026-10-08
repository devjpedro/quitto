import { CheckCircle, Hourglass, WarningCircle } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { InstallmentBar } from "@/components/ui/installment-bar";
import { Money } from "@/components/ui/money";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Tag } from "@/components/ui/tag";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import {
  type CardCell,
  type CardTag,
  contractCardView,
} from "../lib/contract-card-view";
import type { ContractListItem } from "../types";

const TAG_ICON = {
  check: CheckCircle,
  overdue: WarningCircle,
  review: Hourglass,
} as const;

function Cell({ cell }: { cell: CardCell }) {
  return (
    <div className="min-w-0 bg-surface-inset px-2.5 py-2 first:rounded-l-control last:rounded-r-control">
      <div className="text-[11.5px] text-ink-muted">{cell.label}</div>
      <div className="mt-0.5 truncate font-medium text-sm tabular-nums">
        {cell.cents === null ? cell.text : <Money cents={cell.cents} />}
      </div>
    </div>
  );
}

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
 * One contract (mockup 17, frame A): the role, the title, the other party, the
 * % with the segmented bar, three cells and the state at the foot. A filled
 * card (never outlined) that is a link as a whole.
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
  return (
    <Link
      className="flex flex-col gap-3 rounded-card bg-surface-card p-4 transition-[background-color,transform] hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-[.97] motion-reduce:active:scale-100"
      data-testid={`contract-card-${item.id}`}
      params={{ id: item.id }}
      to="/contracts/$id"
    >
      <div className="flex flex-col gap-1.5">
        <Tag tone={view.role.tone}>{view.role.label}</Tag>
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
      <div className="flex items-baseline gap-1.5">
        <span className="font-display font-medium text-[32px] tabular-nums leading-none tracking-[-0.03em]">
          {view.percent}
          <span className="text-[0.55em] tracking-normal">%</span>
        </span>
        <span className="text-ink-muted text-xs">{view.percentLabel}</span>
      </div>
      <InstallmentBar
        installmentsCount={item.installmentsCount}
        overdueCount={item.overdueCount}
        paidCount={item.paidCount}
        statuses={item.statuses}
      />
      <div className="grid grid-cols-3 gap-0.5">
        {view.cells.map((cell) => (
          <Cell cell={cell} key={cell.label} />
        ))}
      </div>
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
