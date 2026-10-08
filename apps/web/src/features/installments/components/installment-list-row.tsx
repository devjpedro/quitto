import {
  CaretDown,
  CaretUp,
  Hourglass,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Locale } from "@quitto/shared";
import { DateTile } from "@/components/ui/date-tile";
import { Money } from "@/components/ui/money";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { InstallmentLineView } from "../lib/installment-line-view";
import type { InstallmentListItem } from "../types";

const ROW =
  "flex min-h-16 w-full items-start gap-3.5 max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)_auto] rounded-[inherit] py-2.5 pr-4 pl-2.5 text-left transition-colors hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset md:items-center";

const TAG_ICON = { overdue: WarningCircle, review: Hourglass } as const;

function LineBody({
  counterparty,
  expanded,
  locale,
  view,
}: {
  counterparty: string | null;
  /** `null`: not a run (no caret). */
  expanded: boolean | null;
  locale: Locale;
  view: InstallmentLineView;
}) {
  const receive = view.direction === "receive";
  const TagIcon = view.tag?.icon ? TAG_ICON[view.tag.icon] : null;
  const Caret = expanded ? CaretUp : CaretDown;
  const meta = [counterparty, view.sequences, view.ago].filter(Boolean);
  return (
    <>
      <span className="relative shrink-0 max-md:row-span-3">
        <DateTile iso={view.tileDate} locale={locale} />
        {view.run > 1 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-ink font-semibold text-[11px] text-ink-inverse tabular-nums leading-none"
          >
            {view.run}
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 max-md:contents">
        <span className="min-w-0 truncate font-medium text-sm max-md:col-start-2 max-md:row-start-1">
          {view.title}
        </span>{" "}
        {view.run > 1 ? (
          <span className="sr-only">
            {m.installments_run_count({ count: view.run })}
          </span>
        ) : null}
        {view.tag ? (
          <Tag
            className="self-center max-md:col-span-2 max-md:col-start-2 max-md:row-start-3 max-md:justify-self-start md:order-2"
            tone={view.tag.tone}
          >
            {TagIcon ? <TagIcon aria-hidden="true" size={12.5} /> : null}
            {view.tag.label}
          </Tag>
        ) : null}{" "}
        <span className="flex min-w-0 basis-full items-center gap-2 text-[12.5px] text-ink-muted max-md:col-span-2 max-md:col-start-2 max-md:row-start-2 md:order-3">
          {counterparty ? <PersonAvatar name={counterparty} /> : null}
          <span className="min-w-0 truncate tabular-nums">
            {meta.join(` ${m.contract_sep()} `)}
          </span>
        </span>
      </span>{" "}
      <span className="flex shrink-0 items-center gap-2 max-md:col-start-3 max-md:row-start-1">
        {expanded === null ? null : (
          <Caret
            aria-hidden="true"
            className="shrink-0 text-ink-muted"
            size={16}
          />
        )}
        <Money
          cents={view.amountCents}
          className={cn(
            "shrink-0 text-right",
            receive ? "text-brand" : "text-ink"
          )}
          sign={receive ? "+" : "−"}
          size="list"
        />
      </span>
    </>
  );
}

/** One installment (mockup 17, C): the whole line opens it in the panel. */
export function InstallmentListRow({
  item,
  locale,
  nested = false,
  onIntent,
  onOpen,
  selected,
  view,
}: {
  item: InstallmentListItem;
  locale: Locale;
  /** An installment under its run: the contract and the person are on the run's line, so it says only "Parcela 3 de 12". */
  nested?: boolean;
  /** Hover or focus: the panel's data starts loading. */
  onIntent: (item: InstallmentListItem) => void;
  onOpen: (id: string) => void;
  selected: boolean;
  view: InstallmentLineView;
}) {
  return (
    <button
      aria-current={selected ? "true" : undefined}
      className={cn(ROW, selected && "bg-row-selected hover:bg-row-selected")}
      data-installment-row={item.installmentId}
      data-testid={`installment-row-${item.installmentId}`}
      onClick={() => onOpen(item.installmentId)}
      onFocus={() => onIntent(item)}
      onPointerEnter={() => onIntent(item)}
      type="button"
    >
      <LineBody
        counterparty={nested ? null : item.counterpartyName}
        expanded={null}
        locale={locale}
        view={
          nested
            ? {
                ...view,
                sequences: "",
                title: m.panel_title({
                  count: item.installmentsCount,
                  sequence: item.sequence,
                }),
              }
            : view
        }
      />
    </button>
  );
}

/** Several overdue installments of one contract as one line (decision 3): it opens in place. */
export function InstallmentRunRow({
  expanded,
  items,
  locale,
  onToggle,
  view,
}: {
  expanded: boolean;
  items: InstallmentListItem[];
  locale: Locale;
  onToggle: () => void;
  view: InstallmentLineView;
}) {
  const [first] = items;
  return (
    <button
      aria-expanded={expanded}
      className={ROW}
      data-group-ids={items.map((it) => it.installmentId).join(" ")}
      data-testid={`installment-run-${first?.installmentId}`}
      onClick={onToggle}
      type="button"
    >
      <LineBody
        counterparty={first?.counterpartyName ?? null}
        expanded={expanded}
        locale={locale}
        view={view}
      />
    </button>
  );
}
