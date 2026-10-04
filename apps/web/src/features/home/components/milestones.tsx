import type { Locale } from "@quitto/shared";
import { useId } from "react";
import { Money } from "@/components/ui/money";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Tag } from "@/components/ui/tag";
import { formatMoney } from "@/lib/locale-format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import {
  type MilestoneCell,
  milestoneCells,
  onlyMomentStrip,
  sharePercent,
  stripCells,
} from "../lib/milestones";
import { type MomentMilestone, momentView } from "../lib/moment";
import type { HomeMilestones } from "../types";
import { SectionTitle } from "./section-title";

/** A milestone's bar: decorative, the % is written beside the label. */
function Bar({ percent }: { percent: number }) {
  return (
    <span
      aria-hidden="true"
      className="mt-3 block h-1.5 overflow-hidden rounded-full bg-track"
    >
      <span
        className="block h-full min-w-1.5 rounded-full bg-brand"
        style={{ width: `${percent}%` }}
      />
    </span>
  );
}

function LabelRow({
  label,
  percent,
}: {
  label: string;
  percent: number | null;
}) {
  return (
    <span className="flex items-baseline justify-between gap-2 text-[12.5px] text-ink-muted">
      <span>{label}</span>
      {percent === null ? null : (
        <b className="font-semibold text-[13px] text-ink tabular-nums">
          {m.home_percent({ percent })}
        </b>
      )}
    </span>
  );
}

/** A value milestone (DIRECAO › Progresso): the value, "de R$ X", the % and a bar when there is a whole to measure against. */
function ValueCell({
  cents,
  label,
  locale,
  totalCents,
}: {
  cents: number;
  label: string;
  locale: Locale;
  totalCents: number | null;
}) {
  const percent = totalCents ? sharePercent(cents, totalCents) : null;
  return (
    <>
      <LabelRow label={label} percent={percent} />
      <Money cents={cents} className="mt-1.5 block" size="milestone" />
      {totalCents ? (
        <span className="mt-0.5 block truncate text-[12.5px] text-ink-muted tabular-nums">
          {m.home_milestone_of({ amount: formatMoney(totalCents, locale) })}
        </span>
      ) : null}
      {percent === null ? null : <Bar percent={percent} />}
    </>
  );
}

interface CellProps {
  cell: MilestoneCell;
  locale: Locale;
  today: string;
}

/** Label and title come from momentView, the lime card's text: the strip and the sidebar always say the same. */
function CellView({ cell, locale, today }: CellProps) {
  switch (cell.id) {
    case "all_clear": {
      const view = momentView(cell, locale, today);
      return (
        <>
          <Tag className="whitespace-nowrap" tone="highlight">
            {view.label}
          </Tag>
          <span className="mt-2 block text-sm">{view.title}</span>
        </>
      );
    }
    case "closest": {
      const view = momentView(cell, locale, today);
      return (
        <>
          <LabelRow label={view.label} percent={cell.percent} />
          <span className="mt-1.5 block truncate font-medium text-sm">
            {view.title}
          </span>
          <Bar percent={cell.percent} />
        </>
      );
    }
    case "received":
    case "paid":
      return (
        <ValueCell
          cents={cell.cents}
          label={momentView(cell, locale, today).label}
          locale={locale}
          totalCents={null}
        />
      );
    case "settled_paid":
      return (
        <ValueCell
          cents={cell.cents}
          label={m.home_milestone_settled_paid()}
          locale={locale}
          totalCents={cell.totalCents}
        />
      );
    default:
      return (
        <ValueCell
          cents={cell.cents}
          label={m.home_milestone_settled_received()}
          locale={locale}
          totalCents={cell.totalCents}
        />
      );
  }
}

/** The milestone of the moment, opening the strip on a phone: lime, with the 44 px ring (mockup 13, frame D). */
function MomentCell({ cell, locale, today }: CellProps) {
  const view = momentView(cell as MomentMilestone, locale, today);
  return (
    <>
      {view.percent === null ? null : (
        <ProgressRing percent={view.percent} size={44} tone="onHighlight" />
      )}
      <span className="min-w-0">
        <span className="block text-[12.5px]">{view.label}</span>
        <span className="block font-semibold text-[15px] leading-[1.3]">
          {view.title}
        </span>
        {view.detail ? (
          <span className="block text-[12.5px]">{view.detail}</span>
        ) : null}
      </span>
    </>
  );
}

/**
 * Real progress, never decoration (mockup 13): filled cells separated by a
 * 2 px gap in the color behind them (the panel from md, the page on a
 * phone), two columns below lg and one row from lg. From lateral it sits in
 * the home's side column, stacked, two by two once that column has 400 px.
 * The milestone of the moment opens it on a phone; from md the sidebar's
 * lime card shows that one, so the strip hides it there. `today` is the
 * home's: it tells a late installment from one still ahead.
 */
export function Milestones({
  milestones,
  momentId,
  today,
}: {
  milestones: HomeMilestones;
  momentId: string | null;
  today: string;
}) {
  const locale = getLocale();
  const headingId = useId();
  const strip = stripCells(milestoneCells(milestones), momentId);
  if (strip.length === 0) {
    return null;
  }
  const onlyMoment = onlyMomentStrip(milestones, momentId);
  return (
    <section
      aria-labelledby={headingId}
      className={cn("@container", onlyMoment && "md:hidden")}
    >
      <SectionTitle id={headingId}>{m.home_milestones_title()}</SectionTitle>
      <ul className="grid lateral:grid-flow-row grid-cols-2 lateral:@min-[400px]:grid-cols-2 lateral:grid-cols-1 gap-0.5 overflow-hidden rounded-card bg-surface-sunken md:bg-surface lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none">
        {strip.map(({ cell, moment, wide }) => (
          <li
            className={cn(
              "min-w-0 px-4 pt-3.5 pb-4",
              moment
                ? "flex items-center gap-3.5 bg-highlight text-on-highlight md:hidden"
                : "bg-surface-card",
              wide && "col-span-2 lateral:@min-[400px]:col-span-2 lg:col-span-1"
            )}
            key={cell.id}
          >
            {moment ? (
              <MomentCell cell={cell} locale={locale} today={today} />
            ) : (
              <CellView cell={cell} locale={locale} today={today} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
