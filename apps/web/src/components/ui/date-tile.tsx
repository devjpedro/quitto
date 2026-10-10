import type { Locale } from "@quitto/shared";
import { dayOfMonth, monthShort } from "@/lib/date-parts";
import { formatDate } from "@/lib/locale-format";

/**
 * The anchor of a dated row (DIRECAO › "Toda linha tem âncora"): the big day
 * and the short month, one step lighter than the list it sits in.
 */
export function DateTile({ iso, locale }: { iso: string; locale: Locale }) {
  return (
    <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-control bg-surface-inset leading-none">
      <span className="sr-only">{formatDate(iso, locale, "long")}</span>
      <span
        aria-hidden="true"
        className="font-display font-semibold text-lg tabular-nums leading-none tracking-[-0.02em]"
      >
        {dayOfMonth(iso)}
      </span>
      <span aria-hidden="true" className="mt-[3px] text-[11px] text-ink-muted">
        {monthShort(iso, locale)}
      </span>
    </span>
  );
}
