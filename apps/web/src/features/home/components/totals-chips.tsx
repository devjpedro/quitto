import { Money } from "@/components/ui/money";
import { pluralForm } from "@/lib/plural";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

const CHIP =
  "rounded-full border border-line px-3 py-1.5 text-ink-muted text-sm";

export function TotalsChips({
  pendingCount,
  toPayCents,
  toReceiveCents,
}: {
  pendingCount: number;
  toPayCents: number;
  toReceiveCents: number;
}) {
  if (pendingCount === 0 && toPayCents === 0 && toReceiveCents === 0) {
    return null;
  }
  const one = pluralForm(pendingCount, getLocale()) === "one";
  return (
    <ul aria-label={m.home_chips_label()} className="flex flex-wrap gap-1.5">
      {pendingCount > 0 ? (
        <li className="rounded-full border border-highlight bg-highlight px-3 py-1.5 text-on-highlight text-sm">
          <span className="font-semibold tabular-nums">{pendingCount}</span>{" "}
          {one ? m.home_chip_pending_one() : m.home_chip_pending_other()}
        </li>
      ) : null}
      {toPayCents > 0 ? (
        <li className={CHIP}>
          <Money cents={toPayCents} className="font-semibold text-ink" />{" "}
          {m.home_chip_to_pay()}
        </li>
      ) : null}
      {toReceiveCents > 0 ? (
        <li className={CHIP}>
          <Money cents={toReceiveCents} className="font-semibold text-ink" />{" "}
          {m.home_chip_to_receive()}
        </li>
      ) : null}
    </ul>
  );
}
