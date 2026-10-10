import { WhatsappLogo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { pixCodeFor } from "@/features/installments/lib/pix-code";
import {
  chargeMessage,
  groupChargeMessage,
  whatsappUrl,
} from "@/features/installments/lib/whatsapp-message";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { guardLink } from "../lib/guard-link";
import type { NextActionView, PendingAction } from "../lib/next-action";
import type { ContractDetail } from "../types";

export type CardVariant = "onBrand" | "onBrandOutline";

export function WhatsappButton({
  action,
  className,
  detail,
  kind,
  today,
  tryLock,
  variant,
  view,
}: {
  action: PendingAction;
  className?: string;
  detail: ContractDetail;
  kind: "whatsapp_charge" | "whatsapp_remind";
  today: string;
  tryLock: () => boolean;
  variant: CardVariant;
  view: NextActionView;
}) {
  const locale = getLocale();
  const label =
    kind === "whatsapp_charge"
      ? m.home_action_whatsapp()
      : m.contract_action_remind();
  const { installment } = view;
  const paragraphs =
    action.kind === "overdue" && action.installments.length > 1
      ? groupChargeMessage(
          {
            contractTitle: detail.contract.title,
            dueDate: installment.dueDate,
            sequences: action.installments.map((it) => it.sequence),
            totalCents: view.amountCents,
          },
          locale
        )
      : chargeMessage(
          {
            amountCents: installment.amountCents,
            contractTitle: detail.contract.title,
            dueDate: installment.dueDate,
            installmentsCount: detail.installments.length,
            pixCode: pixCodeFor(
              detail.receiver.pix,
              detail.receiver.name,
              installment.amountCents
            ),
            sequence: installment.sequence,
            todayISO: today,
          },
          locale
        );
  return (
    <Button asChild className={className} size="sm" variant={variant}>
      <a
        aria-label={`${label} ${m.home_action_whatsapp_hint()}`}
        href={whatsappUrl(paragraphs)}
        onClick={guardLink(tryLock)}
        rel="noopener noreferrer"
        target="_blank"
      >
        <WhatsappLogo aria-hidden="true" size={16} />
        {kind === "whatsapp_charge" ? (
          <>
            {/* A narrow card (a phone) says "Cobrar"; the name keeps the whole label. */}
            <span className="@max-[23.5rem]:hidden">{label}</span>
            <span className="@max-[23.5rem]:inline hidden">
              {m.contract_action_charge_short()}
            </span>
          </>
        ) : (
          label
        )}
      </a>
    </Button>
  );
}
