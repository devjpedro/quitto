import { Receipt } from "@phosphor-icons/react";
import { IconTile } from "@/components/ui/icon-tile";
import type { ContractDetail } from "@/features/contracts/types";
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
import { ReceiptPdfButton, ReceiptPrimaryButton } from "./receipt-actions";

/**
 * The block's two buttons: "Abrir recibo" and "Baixar PDF". The bottom sheet
 * pins the primary in its footer, so there the block keeps only the PDF of
 * the owner (whoever downloads already has it pinned).
 */
function ReceiptButtons({
  actions,
  mode,
  primary,
}: {
  actions: ReceiptActions;
  mode: PanelMode;
  primary: PanelPrimary;
}) {
  const owner = primary !== "receipt_pdf";
  if (mode === "bottom" && !owner) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {mode === "bottom" ? null : (
        <ReceiptPrimaryButton
          actions={actions}
          className="min-w-0 flex-1"
          primary={primary}
        />
      )}
      {owner ? (
        <ReceiptPdfButton
          actions={actions}
          className={cn("min-w-0 flex-1", PANEL_TONE[mode].innerButton)}
          variant="inset"
        />
      ) : null}
    </div>
  );
}

/**
 * P5 (mockup 14, frame G): the receipt of a paid installment. The owner
 * opens it ("Abrir recibo": the page shares, prints and downloads it); the
 * others download it. Both have "Baixar PDF".
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
  const actions = useReceiptActions(detail);
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
      <ReceiptButtons actions={actions} mode={mode} primary={primary} />
    </div>
  );
}
