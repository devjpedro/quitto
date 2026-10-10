import { Hourglass, WarningCircle } from "@phosphor-icons/react";
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
  locale,
  view,
}: {
  counterparty: string | null;
  locale: Locale;
  view: InstallmentLineView;
}) {
  const receive = view.direction === "receive";
  const TagIcon = view.tag?.icon ? TAG_ICON[view.tag.icon] : null;
  const meta = [counterparty, view.sequences, view.ago].filter(Boolean);
  return (
    <>
      <span className="relative shrink-0 max-md:row-span-3">
        <DateTile iso={view.tileDate} locale={locale} />
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 max-md:contents">
        <span className="min-w-0 truncate font-medium text-sm max-md:col-start-2 max-md:row-start-1">
          {view.title}
        </span>{" "}
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
  onIntent,
  onOpen,
  selected,
  view,
}: {
  item: InstallmentListItem;
  locale: Locale;
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
        counterparty={item.counterpartyName}
        locale={locale}
        view={view}
      />
    </button>
  );
}
