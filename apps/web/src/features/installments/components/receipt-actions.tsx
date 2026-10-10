import { FilePdf, ShareNetwork, WhatsappLogo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { perspectiveOf } from "@/features/contracts/lib/contract-view";
import type { ContractDetail } from "@/features/contracts/types";
import { m } from "@/paraglide/messages.js";
import type { ReceiptActions } from "../hooks/use-receipt-actions";
import type { PanelPrimary } from "../lib/panel-actions";

/** The other side's first name: the payer to whoever receives. */
function counterpartFirstName(contract: ContractDetail): string {
  const otherRole =
    perspectiveOf(contract.role) === "receive" ? "buyer" : "seller";
  const name =
    contract.participants.find((p) => p.role === otherRole)?.displayName ?? "";
  return name.split(" ")[0] ?? name;
}

/** The receipt's main action, inline in the block and pinned in the bottom sheet's footer. */
export function ReceiptPrimaryButton({
  actions,
  className,
  contract,
  primary,
}: {
  actions: ReceiptActions;
  className?: string;
  contract: ContractDetail;
  primary: PanelPrimary;
}) {
  if (primary === "share_receipt") {
    return (
      <Button
        className={className}
        disabled={actions.pending}
        onClick={actions.shareReceipt}
      >
        <ShareNetwork aria-hidden="true" size={16} />
        {m.panel_receipt_share()}
      </Button>
    );
  }
  if (primary === "whatsapp_receipt") {
    return (
      <Button
        className={className}
        disabled={actions.pending}
        onClick={actions.sendWhatsapp}
      >
        <WhatsappLogo aria-hidden="true" size={16} />
        {m.panel_receipt_whatsapp_to({ name: counterpartFirstName(contract) })}
      </Button>
    );
  }
  return (
    <Button asChild className={className}>
      <a download href={actions.pdfHref} onClick={actions.guardLink}>
        <FilePdf aria-hidden="true" size={16} />
        {m.panel_receipt_pdf()}
      </a>
    </Button>
  );
}
