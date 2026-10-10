import type { Locale } from "@quitto/shared";
import { useId } from "react";
import { SectionTitle } from "@/components/ui/section-title";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import {
  type MilestoneCell,
  type MomentMilestoneCell,
  milestoneCells,
  onlyMomentStrip,
  stripCells,
} from "../lib/milestones";
import { momentView } from "../lib/moment";
import type { HomeMilestones } from "../types";
import {
  Bar,
  LabelRow,
  MILESTONE_ROW,
  MomentCell,
  ValueCell,
} from "./milestone-cells";

/** "Marcos" shows this many one-line rows (mockup 20, B1). */
const MILESTONE_ROWS = 3;

/** Label and title come from momentView, the lime card's text: the strip and the sidebar always say the same. */
function CellView({
  cell,
  locale,
  today,
}: {
  cell: MilestoneCell;
  locale: Locale;
  today: string;
}) {
  switch (cell.id) {
    case "all_clear": {
      const view = momentView(cell, locale, today);
      return (
        <div className={MILESTONE_ROW}>
          <span className="order-1">
            <Tag tone="highlight">{view.label}</Tag>
          </span>
          <span className="order-2 col-span-2 text-sm md:col-span-3">
            {view.title}
          </span>
        </div>
      );
    }
    case "closest": {
      const view = momentView(cell, locale, today);
      return (
        <div className={MILESTONE_ROW}>
          <LabelRow label={view.label} />
          <span className="order-2 truncate font-medium text-sm">
            {view.title}
          </span>
          <Bar percent={cell.percent} />
        </div>
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

/**
 * Real progress, never decoration (mockup 13): filled cells separated by a
 * 2 px gap in the color behind them (the panel from md, the page on a
 * phone), two columns below lg and one row from lg. From lateral it sits in
 * the home's side column, stacked (or under "Próximos 30 dias" with few cards).
 * No % on the accumulated ones: it belongs to the milestone of the moment.
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
  const rows = strip.filter((item) => !item.moment).slice(0, MILESTONE_ROWS);
  const moment = strip.find((item) => item.moment);
  return (
    <section
      aria-labelledby={headingId}
      className={cn("@container", onlyMoment && "md:hidden")}
    >
      <SectionTitle id={headingId}>{m.home_milestones_title()}</SectionTitle>
      {/* The milestone of the moment is the sidebar's lime card from md; the phone gets it here. */}
      {moment ? (
        <div className="mb-2 flex items-center gap-3.5 rounded-card bg-highlight px-4 py-3.5 text-on-highlight md:hidden">
          <MomentCell
            cell={moment.cell as MomentMilestoneCell}
            locale={locale}
            today={today}
          />
        </div>
      ) : null}
      {rows.length > 0 ? (
        <ul className="divide-y divide-divider overflow-hidden rounded-card bg-surface-card">
          {rows.map(({ cell }) => (
            <li
              className="flex min-h-16 min-w-0 flex-col justify-center px-4 py-3.5"
              key={cell.id}
            >
              <CellView cell={cell} locale={locale} today={today} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
