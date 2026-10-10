import { Copy, FilePdf, LinkSimple, Receipt } from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import type { ContractDetail } from "@/features/contracts/types";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import {
  type ReceiptActions,
  useReceiptActions,
} from "../hooks/use-receipt-actions";
import {
  type PanelPrimary,
  panelInputOf,
  panelView,
} from "../lib/panel-actions";
import type { InstallmentDetail } from "../types";
import { PANEL_TONE, type PanelMode } from "./panel-context";
import { ReceiptPrimaryButton } from "./receipt-actions";

const PROTOCOL_RE = /^https?:\/\//;

function LinkLine({
  actions,
  mode,
}: {
  actions: ReceiptActions;
  mode: PanelMode;
}) {
  const copy = useCopy();
  const url = actions.existing;
  if (!url) {
    return null;
  }
  const tone = PANEL_TONE[mode];
  return (
    <div
      className={cn(
        "mt-3 flex h-11 min-w-0 items-center gap-2 rounded-control pr-1.5 pl-3 md:h-10",
        tone.inner
      )}
    >
      <span className="min-w-0 flex-1 truncate font-mono text-ink-muted text-xs">
        {url.replace(PROTOCOL_RE, "")}
      </span>
      <Button
        aria-label={m.panel_receipt_copy_label()}
        className={cn("md:h-8", tone.button)}
        onClick={() => copy(url, m.panel_link_copied())}
        size="sm"
        variant="inset"
      >
        <Copy aria-hidden="true" size={15} />
        {m.panel_receipt_copy()}
      </Button>
    </div>
  );
}

/** The buttons under the link, by the panel's primary (the bottom sheet pins the primary in its footer). */
function ReceiptButtons({
  actions,
  contract,
  mode,
  primary,
}: {
  actions: ReceiptActions;
  contract: ContractDetail;
  mode: PanelMode;
  primary: PanelPrimary;
}) {
  const secondary = cn(
    buttonVariants({ variant: "inset" }),
    PANEL_TONE[mode].innerButton
  );
  const inline = mode !== "bottom";
  const main = inline ? (
    <ReceiptPrimaryButton
      actions={actions}
      className="min-w-0 flex-1"
      contract={contract}
      primary={primary}
    />
  ) : null;
  if (primary === "whatsapp_receipt") {
    // Inline: the main and the PDF, the copy on a row of its own (mockup 14,
    // G "ing1"); in the bottom sheet the main is in the footer, and the two
    // left share a row.
    const grow = inline ? undefined : "flex-[1_0_auto]";
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {main}
        <a
          className={cn(secondary, grow)}
          download
          href={actions.pdfHref}
          onClick={actions.guardLink}
        >
          <FilePdf aria-hidden="true" size={16} />
          {m.panel_receipt_pdf_short()}
        </a>
        <button
          className={cn(secondary, inline ? "w-full" : grow)}
          disabled={actions.pending}
          onClick={actions.copyLink}
          type="button"
        >
          <LinkSimple aria-hidden="true" size={16} />
          {m.panel_receipt_copy_link()}
        </button>
      </div>
    );
  }
  const pdf =
    primary === "share_receipt" ? (
      <a
        className={cn(secondary, !inline && "flex-[1_0_auto]")}
        download
        href={actions.pdfHref}
        onClick={actions.guardLink}
      >
        <FilePdf aria-hidden="true" size={16} />
        {m.panel_receipt_pdf()}
      </a>
    ) : null;
  if (!(main || pdf)) {
    return null;
  }
  // No WhatsApp of its own: "Compartilhar recibo" reaches it, once per
  // screen (14-G P5). In the bottom sheet the main is in the footer.
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {main}
      {pdf}
    </div>
  );
}

/**
 * P5 (mockup 14, frame G): the receipt of a paid installment. The owner
 * shares it (or sends it on WhatsApp to a contact with no account); the
 * others download it. With the link already made, it shows, with Copiar.
 */
export function ReceiptBlock({
  contract,
  detail,
  mode,
}: {
  contract: ContractDetail;
  detail: InstallmentDetail;
  mode: PanelMode;
}) {
  const actions = useReceiptActions(detail, contract);
  const { primary } = panelView(panelInputOf(contract, detail));
  if (!primary) {
    return null;
  }
  return (
    <div
      className={cn("rounded-card p-3.5", PANEL_TONE[mode].block)}
      data-testid="receipt-block"
    >
      <div className="flex items-center gap-2.5">
        <IconTile icon={Receipt} tone="brand" />
        <p className="min-w-0">
          <span className="block font-semibold text-[13.5px] text-ink">
            {m.panel_receipt_title({ sequence: detail.sequence })}
          </span>{" "}
          <span className="block text-[12.5px] text-ink-muted">
            {m.panel_receipt_hint()}
          </span>
        </p>
      </div>
      {primary === "whatsapp_receipt" ? null : (
        <LinkLine actions={actions} mode={mode} />
      )}
      <ReceiptButtons
        actions={actions}
        contract={contract}
        mode={mode}
        primary={primary}
      />
    </div>
  );
}
