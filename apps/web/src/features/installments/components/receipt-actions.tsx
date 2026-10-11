import { ArrowSquareOut, FilePdf } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";
import type { ReceiptActions } from "../hooks/use-receipt-actions";
import type { PanelPrimary } from "../lib/panel-actions";

/**
 * The receipt's main action, inline in the block and pinned in the bottom
 * sheet's footer. The owner has one: "Abrir recibo" (the page has the PDF,
 * the share and the print); whoever cannot make a link downloads the PDF.
 * `ReceiptPdfButton` is that download, also beside "Abrir recibo" in the block.
 */
export function ReceiptPdfButton({
  actions,
  className,
  variant,
}: {
  actions: ReceiptActions;
  className?: string;
  variant?: "inset";
}) {
  return (
    <Button asChild className={className} variant={variant}>
      <a download href={actions.pdfHref} onClick={actions.guardLink}>
        <FilePdf aria-hidden="true" size={16} />
        {m.panel_receipt_pdf()}
      </a>
    </Button>
  );
}

export function ReceiptPrimaryButton({
  actions,
  className,
  primary,
}: {
  actions: ReceiptActions;
  className?: string;
  primary: PanelPrimary;
}) {
  if (primary === "receipt_pdf") {
    return <ReceiptPdfButton actions={actions} className={className} />;
  }
  if (actions.existing) {
    return (
      <Button asChild className={className}>
        <a
          href={actions.existing}
          onClick={actions.guardLink}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ArrowSquareOut aria-hidden="true" size={16} />
          {m.panel_receipt_open()}
        </a>
      </Button>
    );
  }
  return (
    <Button
      className={className}
      disabled={actions.pending}
      onClick={actions.openReceipt}
    >
      <ArrowSquareOut aria-hidden="true" size={16} />
      {m.panel_receipt_open()}
    </Button>
  );
}
