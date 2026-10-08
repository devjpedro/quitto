import { WarningCircle } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { ChipStrip, MoneyChip } from "@/components/ui/chip-strip";
import { m } from "@/paraglide/messages.js";

/**
 * The overdue chips (owner's decision 8, by direction and never summed, with
 * an icon so the status is not color alone). A chip is there only when it
 * says more than a card (overdueChips); the rest of the totals went to the
 * subtitle and to the title of "Próximos 30 dias" (DIRECAO › Home enxuta).
 */
export function TotalsChips({
  overdueToPayCents,
  overdueToReceiveCents,
}: {
  overdueToPayCents: number | null;
  overdueToReceiveCents: number | null;
}) {
  const chips: ReactNode[] = [];
  if (overdueToPayCents !== null) {
    chips.push(
      <MoneyChip
        cents={overdueToPayCents}
        icon={WarningCircle}
        key="overdue-pay"
        label={m.home_chip_overdue_pay()}
        tone="danger"
      />
    );
  }
  if (overdueToReceiveCents !== null) {
    chips.push(
      <MoneyChip
        cents={overdueToReceiveCents}
        icon={WarningCircle}
        key="overdue-receive"
        label={m.home_chip_overdue_receive()}
        tone="danger"
      />
    );
  }
  if (chips.length === 0) {
    return null;
  }
  return <ChipStrip label={m.home_chips_label()}>{chips}</ChipStrip>;
}
