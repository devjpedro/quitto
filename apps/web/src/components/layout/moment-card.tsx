import { ProgressRing } from "@/components/ui/progress-ring";
import { m } from "@/paraglide/messages.js";

/** The milestone of the moment, already worded (features/home picks it, through ShellProps). */
export interface MomentCardView {
  detail: string | null;
  label: string;
  /** null when the milestone is not progress (paid or received this month): no ring. */
  percent: number | null;
  title: string;
}

/**
 * The milestone of the moment at the foot of the sidebar (mockup 13): lime
 * with dark text, the label with the logo's ring and the % on the same line,
 * then the milestone and its detail. Never lime text on a light surface.
 */
export function MomentCard({ moment }: { moment: MomentCardView }) {
  return (
    <div className="rounded-card bg-highlight px-3.5 pt-3 pb-[13px] text-on-highlight">
      <p className="flex items-center justify-between gap-2 text-xs leading-[1.4]">
        <span>{moment.label}</span>
        {moment.percent === null ? null : (
          <span className="inline-flex items-center gap-[5px] font-semibold tabular-nums">
            <ProgressRing
              percent={moment.percent}
              size={22}
              tone="onHighlight"
            />
            {m.home_percent({ percent: moment.percent })}
          </span>
        )}
      </p>
      <p className="mt-1 truncate font-semibold text-sm leading-[1.35]">
        {moment.title}
      </p>
      {moment.detail ? (
        <p className="mt-px text-xs leading-[1.4]">{moment.detail}</p>
      ) : null}
    </div>
  );
}
