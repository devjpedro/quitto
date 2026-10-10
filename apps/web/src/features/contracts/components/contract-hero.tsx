import { InstallmentBar } from "@/components/ui/installment-bar";
import { InstallmentBarKey } from "@/components/ui/installment-bar-key";
import { Money } from "@/components/ui/money";
import { formatMoney } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { heroView, perspectiveOf } from "../lib/contract-view";
import { barView, legendEnd, legendEntries } from "../lib/status-counts";
import type { ContractDetail } from "../types";

/** "Falta receber", the total under it, the bar (8 px, once per contract) and its key (mockup 14, enxuto). */
export function ContractHero({
  detail,
  today,
}: {
  detail: ContractDetail;
  today: string;
}) {
  const locale = getLocale();
  const perspective = perspectiveOf(detail.role);
  const hero = heroView(detail, perspective);
  const bar = barView(detail.installments, today);
  return (
    <section aria-label={hero.label} data-testid="contract-hero">
      <p className="text-[13px] text-ink-muted">{hero.label}</p>
      <Money cents={hero.cents} className="mt-0.5 block" size="hero" />
      {hero.ofCents === null ? null : (
        <p className="mt-0.5 text-[13.5px] text-ink-muted tabular-nums">
          {m.contract_hero_of({ amount: formatMoney(hero.ofCents, locale) })}
        </p>
      )}
      <InstallmentBar
        className="mt-4"
        installmentsCount={detail.installments.length}
        overdueCount={bar.overdueCount}
        paidCount={bar.paidCount}
        size="tall"
        statuses={bar.statuses}
      />
      <InstallmentBarKey
        end={legendEnd(detail.installments, locale)}
        entries={legendEntries(
          detail.installments,
          today,
          perspective,
          detail.contract.requiresConfirmation,
          locale
        )}
      />
    </section>
  );
}
