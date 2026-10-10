import { WhatsappLogo } from "@phosphor-icons/react";
import type { MouseEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { PersonAvatar } from "@/components/ui/person-avatar";
import type { ContractDetail } from "@/features/contracts/types";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { chargeMessage, whatsappUrl } from "../lib/whatsapp-message";
import type { InstallmentDetail } from "../types";
import type { PanelBlockProps } from "./panel-blocks";
import { PANEL_TONE, usePanel } from "./panel-context";

/** The charge's paragraphs (spec §4.2): the installment, then the receiver's own Pix code when there is one. */
function chargeOf(
  contract: ContractDetail,
  detail: InstallmentDetail,
  today: string
): string[] {
  return chargeMessage(
    {
      amountCents: detail.amountCents,
      contractTitle: contract.contract.title,
      dueDate: detail.dueDate,
      installmentsCount: contract.installments.length,
      pixCode: detail.pix?.copiaECola ?? null,
      sequence: detail.sequence,
      todayISO: today,
    },
    getLocale()
  );
}

/**
 * "Cobrar no WhatsApp": a plain wa.me link with the message ready on the
 * click (planner's decision 12), inline in the block and pinned in the
 * bottom sheet's footer. It answers to the panel's lock, as every action.
 */
export function ChargeLink({
  className,
  contract,
  detail,
  today,
}: {
  className?: string;
  contract: ContractDetail;
  detail: InstallmentDetail;
  today: string;
}) {
  const { tryLock } = usePanel();
  return (
    <a
      className={cn(buttonVariants(), className)}
      href={whatsappUrl(chargeOf(contract, detail, today))}
      onClick={(event: MouseEvent) => {
        if (!tryLock()) {
          event.preventDefault();
        }
      }}
      rel="noopener noreferrer"
      target="_blank"
    >
      <WhatsappLogo aria-hidden="true" size={16} />
      {m.home_action_whatsapp()}
    </a>
  );
}

/**
 * P3 (mockup 14, frame G): whoever receives sees the message that goes, to
 * whom, and that their Pix code goes with it; then sends it.
 */
export function ChargeBlock({
  contract,
  detail,
  mode,
  route,
}: PanelBlockProps) {
  const tone = PANEL_TONE[mode];
  const payer =
    contract.participants.find((p) => p.role === "buyer")?.displayName ?? "";
  const first = payer.split(" ")[0] ?? payer;
  const [opening] = chargeOf(contract, detail, route.today);
  return (
    <div
      className={cn("rounded-card p-3.5", tone.block)}
      data-testid="charge-block"
    >
      <div className="flex items-center gap-2.5">
        <PersonAvatar name={payer} size="md" />
        <p className="min-w-0 truncate font-semibold text-[13.5px] text-ink">
          {m.panel_charge_title({ name: first })}
        </p>
      </div>
      <p
        className={cn(
          "mt-3 rounded-control px-3 py-2.5 text-[13px] text-ink-muted leading-normal",
          tone.inner
        )}
      >
        {opening}
      </p>
      {detail.pix ? (
        <p className="mt-2.5 text-[12.5px] text-ink-muted">
          {m.panel_charge_with_pix()}
        </p>
      ) : null}
      {mode === "bottom" ? null : (
        <ChargeLink
          className="mt-3 w-full"
          contract={contract}
          detail={detail}
          today={route.today}
        />
      )}
    </div>
  );
}
