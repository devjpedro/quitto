import { Copy, Receipt } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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

/** The button under the link (the bottom sheet pins it in its footer instead). */
function ReceiptButtons({
  actions,
  mode,
  primary,
}: {
  actions: ReceiptActions;
  mode: PanelMode;
  primary: PanelPrimary;
}) {
  if (mode === "bottom" && primary !== "receipt_pdf") {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <ReceiptPrimaryButton
        actions={actions}
        className="min-w-0 flex-1"
        primary={primary}
      />
    </div>
  );
}

/**
 * P5 (mockup 14, frame G): the receipt of a paid installment. The owner
 * opens it ("Abrir recibo": the page shares, prints and downloads it); the
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
      <LinkLine actions={actions} mode={mode} />
      <ReceiptButtons actions={actions} mode={mode} primary={primary} />
    </div>
  );
}
