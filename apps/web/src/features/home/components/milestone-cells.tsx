import type { Locale } from "@quitto/shared";
import { Money } from "@/components/ui/money";
import { ProgressRing } from "@/components/ui/progress-ring";
import { formatMoney } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import { type MomentMilestoneCell, sharePercent } from "../lib/milestones";
import { momentView } from "../lib/moment";

/** A milestone's bar: decorative; "de R$ X" above it says what it measures. */
export function Bar({ percent }: { percent: number }) {
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

/** A cell's first line: what it is, and the % on the right when there is one. */
export function LabelRow({
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
    <>
      <LabelRow label={label} percent={null} />
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
