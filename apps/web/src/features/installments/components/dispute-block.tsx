import { PersonAvatar } from "@/components/ui/person-avatar";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { dayLabel, timeLabel } from "../lib/status-trail";
import type { InstallmentDetail } from "../types";

/**
 * P6 (mockup 14): who disputed, when, and why, on the danger tint. The payer
 * reads it before sending again; the receiver sees what was said.
 */
export function DisputeBlock({
  detail,
  today,
}: {
  detail: InstallmentDetail;
  today: string;
}) {
  const { dispute } = detail;
  if (!dispute) {
    return null;
  }
  const locale = getLocale();
  const name = dispute.byName ?? "";
  return (
    <div
      className="rounded-card bg-danger-subtle p-3.5 text-ink"
      data-testid="dispute-block"
    >
      <div className="flex items-center gap-2.5">
        <PersonAvatar name={name} self={dispute.byMe} size="md" />
        <p className="min-w-0">
          <span className="block font-semibold text-[13.5px]">
            {dispute.byMe
              ? m.panel_dispute_by_you()
              : m.panel_dispute_by({ name })}
          </span>{" "}
          <span className="block text-[12.5px] text-ink-muted tabular-nums">
            {m.panel_dispute_at({
              day: dayLabel(dispute.at, today, locale),
              time: timeLabel(dispute.at, locale),
            })}
          </span>
        </p>
      </div>
      {dispute.reason ? (
        <blockquote className="mt-3 rounded-control bg-surface/70 px-3 py-2.5 text-[13px] leading-normal">
          {m.panel_quote({ text: dispute.reason })}
        </blockquote>
      ) : null}
    </div>
  );
}
