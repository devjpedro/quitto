import {
  CheckCircle,
  FileMagnifyingGlass,
  FileText,
  HourglassMedium,
  type Icon,
  SealCheck,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Money } from "@/components/ui/money";
import { NumberTile } from "@/components/ui/number-tile";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { RowView } from "../lib/installment-row-view";

const TAG_ICON: Record<
  NonNullable<NonNullable<RowView["tag"]>["icon"]>,
  Icon
> = {
  check: CheckCircle,
  seal: SealCheck,
  warning: WarningCircle,
  magnifier: FileMagnifyingGlass,
  hourglass: HourglassMedium,
  file: FileText,
  x: XCircle,
};

export type RowTag = RowView["tag"];

/**
 * The line's body (mockup 14, enxuto): the tile, the title with its tag (a
 * second line for the meta), the amount. On a phone the tag and the meta
 * share the second line. Whitespace between the parts keeps the accessible
 * name readable ("Parcela 3 30 de agosto Atrasada · 36 dias R$ 480,00"); a
 * flex container drops it from the layout.
 */
function RowBody({
  amountCents,
  amountClass,
  lead,
  meta,
  muted,
  sr,
  tag,
  tile,
  title,
}: {
  amountCents: number;
  amountClass?: string;
  /** Said before the title, only to a screen reader (the tile is aria-hidden). */
  lead?: string;
  meta: string | null;
  muted: boolean;
  sr: ReactNode;
  tag: RowTag;
  tile: ReactNode;
  title: string;
}) {
  const TagIcon = tag?.icon ? TAG_ICON[tag.icon] : null;
  return (
    <>
      {tile}
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        {lead ? <span className="sr-only">{lead}</span> : null}{" "}
        <span className="min-w-0 truncate font-medium text-sm max-md:basis-full">
          {title}
        </span>{" "}
        {tag ? (
          <Tag className="self-center" tone={tag.tone}>
            {TagIcon ? <TagIcon aria-hidden="true" size={12.5} /> : null}
            {tag.text}
          </Tag>
        ) : null}
        {sr}{" "}
        {meta ? (
          <span className="text-[12.5px] text-ink-muted tabular-nums md:basis-full">
            {meta}
          </span>
        ) : null}
      </span>{" "}
      <Money
        cents={amountCents}
        className={cn(
          "shrink-0 text-right md:min-w-[112px]",
          amountClass,
          muted && "text-ink-muted"
        )}
        size="list"
      />
    </>
  );
}

const ROW =
  "flex min-h-16 w-full items-center gap-3.5 rounded-[inherit] py-2.5 pr-4 pl-2.5 text-left transition-colors hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset";

/** One installment (DIRECAO › Lista de parcelas): the whole line opens it; no button inside. */
export function InstallmentRow({
  amountCents,
  id,
  onOpen,
  selected,
  sequence,
  view,
}: {
  amountCents: number;
  id: string;
  onOpen: (id: string) => void;
  selected: boolean;
  sequence: number;
  view: RowView;
}) {
  return (
    <button
      aria-current={selected ? "true" : undefined}
      className={cn(ROW, selected && "bg-row-selected hover:bg-row-selected")}
      data-installment-row={id}
      onClick={() => onOpen(id)}
      type="button"
    >
      <RowBody
        amountCents={amountCents}
        // The "03" on the tile is drawn, not said: the name carries the
        // number the card and the panel speak of (review I5).
        lead={m.contract_installment_title({ sequence })}
        meta={view.meta}
        muted={view.muted}
        sr={
          view.srState ? <span className="sr-only">{view.srState}</span> : null
        }
        tag={view.tag}
        tile={
          <NumberTile
            label={String(sequence).padStart(2, "0")}
            selected={selected}
            tone={view.tile}
          />
        }
        title={view.title}
      />
    </button>
  );
}
