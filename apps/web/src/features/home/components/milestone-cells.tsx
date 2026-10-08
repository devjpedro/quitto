import type { Locale } from "@quitto/shared";
import { Money } from "@/components/ui/money";
import { ProgressRing } from "@/components/ui/progress-ring";
import { formatMoney } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import { type MomentMilestoneCell, sharePercent } from "../lib/milestones";
import { momentView } from "../lib/moment";

/** A milestone's bar: decorative; "de R$ X" beside it says what it measures. */
export function Bar({ percent }: { percent: number }) {
  return (
    <span
      aria-hidden="true"
      className="order-5 col-span-2 mt-1 block h-1.5 overflow-hidden rounded-full bg-track md:order-3 md:col-span-1 md:mt-0"
    >
      <span
        className="block h-full min-w-1.5 rounded-full bg-brand"
        style={{ width: `${percent}%` }}
      />
    </span>
  );
}

/** A row's first cell: what it is. */
export function LabelRow({ label }: { label: string }) {
  return (
    <span className="order-1 text-[13px] text-ink-muted md:truncate">
      {label}
    </span>
  );
}

/** The row's grid (mockup 20, B1): label, value, bar and "de R$ X" in one line from md; the bar on a line of its own on a phone. */
export const MILESTONE_ROW =
  "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 md:grid-cols-[9rem_auto_minmax(0,1fr)_auto]";

/** A value milestone (DIRECAO › Progresso): the value, "de R$ X" and a bar when there is a whole to measure against. The % stays with the milestone of the moment. */
export function ValueCell({
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
    <div className={MILESTONE_ROW}>
      <LabelRow label={label} />
      <Money cents={cents} className="order-2 block" size="milestone" />
      {totalCents ? (
        <span className="order-4 row-start-1 justify-self-end truncate text-[12.5px] text-ink-muted tabular-nums md:row-start-auto">
          {m.home_milestone_of({ amount: formatMoney(totalCents, locale) })}
        </span>
      ) : null}
      {percent === null ? null : <Bar percent={percent} />}
    </div>
  );
}

/** The milestone of the moment, opening the strip on a phone: lime, with the 44 px ring (mockup 13, frame D). */
export function MomentCell({
  cell,
  locale,
  today,
}: {
  cell: MomentMilestoneCell;
  locale: Locale;
  today: string;
}) {
  const view = momentView(cell, locale, today, "phone");
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
          <span className="block text-pretty text-[12.5px]">{view.detail}</span>
        ) : null}
      </span>
    </>
  );
}
