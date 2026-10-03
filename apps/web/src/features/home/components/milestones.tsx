import type { Locale } from "@quitto/shared";
import { useId } from "react";
import { Money } from "@/components/ui/money";
import { Tag } from "@/components/ui/tag";
import { formatMonthName } from "@/lib/locale-format";
import { pluralForm } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import {
  type MilestoneCell,
  milestoneCells,
  stripCells,
} from "../lib/milestones";
import type { HomeMilestones } from "../types";

const BAR =
  "mt-1 h-1.5 w-full appearance-none overflow-hidden rounded-full bg-surface-sunken [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-brand [&::-webkit-progress-bar]:bg-surface-sunken [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-brand";

function Labeled({ cents, label }: { cents: number; label: string }) {
  return (
    <>
      <span className="text-ink-muted text-xs">{label}</span>
      <Money cents={cents} className="font-medium text-sm" />
    </>
  );
}

function CellView({ cell, locale }: { cell: MilestoneCell; locale: Locale }) {
  switch (cell.id) {
    case "all_clear":
      return (
        <>
          <Tag className="whitespace-nowrap" tone="highlight">
            {m.home_milestone_all_clear({
              month: formatMonthName(cell.month, locale),
            })}
          </Tag>
          <span className="text-sm">
            {pluralForm(cell.paidCount, locale) === "one"
              ? m.home_milestone_all_clear_detail_one()
              : m.home_milestone_all_clear_detail_other({
                  count: cell.paidCount,
                })}
          </span>
        </>
      );
    case "closest":
      return (
        <>
          <span className="text-ink-muted text-xs">
            {m.home_milestone_closest()}
          </span>
          <span className="font-medium text-sm">
            {m.home_milestone_closest_value({
              title: cell.title,
              paid: cell.paidCount,
              total: cell.totalCount,
            })}
          </span>
          <progress
            aria-label={m.home_milestone_closest_progress({
              percent: cell.percent,
            })}
            className={BAR}
            max={100}
            value={cell.percent}
          />
        </>
      );
    case "received":
      return (
        <Labeled
          cents={cell.cents}
          label={m.home_milestone_received({
            month: formatMonthName(cell.month, locale),
          })}
        />
      );
    case "paid":
      return (
        <Labeled
          cents={cell.cents}
          label={m.home_milestone_paid({
            month: formatMonthName(cell.month, locale),
          })}
        />
      );
    case "settled_paid":
      return (
        <Labeled cents={cell.cents} label={m.home_milestone_settled_paid()} />
      );
    default:
      return (
        <Labeled
          cents={cell.cents}
          label={m.home_milestone_settled_received()}
        />
      );
  }
}

/**
 * Real progress, never decoration: a strip of cells with straight dividers
 * (gap-px over the line color), two columns below lg and one row from lg.
 * From lateral it sits in the home's side column (mockup 12): stacked under
 * a visible "Marcos", two by two once that column has 400 px (the section is
 * a size container). The milestone of the moment (`momentId`) opens it on a
 * phone; from md the sidebar's lime card shows that one, so the strip hides
 * it there.
 */
export function Milestones({
  milestones,
  momentId,
}: {
  milestones: HomeMilestones;
  momentId: string | null;
}) {
  const locale = getLocale();
  const headingId = useId();
  const strip = stripCells(milestoneCells(milestones), momentId);
  if (strip.length === 0) {
    return null;
  }
  const onlyMoment = strip.every((item) => item.moment);
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "@container flex flex-col lateral:gap-2",
        onlyMoment && "md:hidden"
      )}
    >
      {/* Same look as the "Próximos 30 dias" title; read aloud at any width. */}
      <h2
        className="sr-only lateral:not-sr-only font-medium text-ink-muted text-sm"
        id={headingId}
      >
        {m.home_milestones_title()}
      </h2>
      <ul className="grid lateral:grid-flow-row grid-cols-2 lateral:@min-[400px]:grid-cols-2 lateral:grid-cols-1 gap-px overflow-hidden rounded-card border border-line bg-line lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none">
        {strip.map(({ cell, moment, wide }) => (
          <li
            className={cn(
              "flex flex-col gap-1 bg-surface-raised p-3.5",
              wide &&
                "col-span-2 lateral:@min-[400px]:col-span-2 lg:col-span-1",
              moment && "md:hidden"
            )}
            key={cell.id}
          >
            <CellView cell={cell} locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  );
}
