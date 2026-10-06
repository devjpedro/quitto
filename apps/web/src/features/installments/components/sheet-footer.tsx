import { Paperclip } from "@phosphor-icons/react";
import { todayISO } from "@quitto/shared";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ContractDetail } from "@/features/contracts/types";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { installmentQueryOptions } from "../api";
import { useReceiptActions } from "../hooks/use-receipt-actions";
import {
  type PanelPrimary,
  panelInputOf,
  panelView,
} from "../lib/panel-actions";
import type { InstallmentDetail } from "../types";
import { ChargeLink } from "./charge-block";
import { PANEL_TONE, usePanel } from "./panel-context";
import { ReceiptPrimaryButton } from "./receipt-actions";
import { ConfirmButton } from "./review-block";

interface FooterProps {
  className: string;
  contract: ContractDetail;
  detail: InstallmentDetail;
  primary: PanelPrimary;
}

function ReceiptFooter({ className, contract, detail, primary }: FooterProps) {
  const actions = useReceiptActions(detail, contract);
  return (
    <ReceiptPrimaryButton
      actions={actions}
      className={className}
      contract={contract}
      primary={primary}
    />
  );
}

/**
 * "Enviar comprovante", pinned with the file's limit under it (mockup 14,
 * frame E). Beside the Pix, "Copiar código PIX" is the black one, so this
 * steps back to the block's fill; alone (P2, P6) it is the primary. While a
 * proof goes, it waits.
 */
function SendProofFooter({ className, contract, detail }: FooterProps) {
  const { busy, chooseFile, tryLock } = usePanel();
  const { blocks } = panelView(panelInputOf(contract, detail));
  const besidePix = detail.pix !== null && blocks.includes("pix");
  return (
    <div className="flex flex-col gap-2">
      <Button
        className={cn(className, besidePix && PANEL_TONE.bottom.button)}
        disabled={busy}
        onClick={() => {
          if (tryLock()) {
            chooseFile();
          }
        }}
        variant={besidePix ? "inset" : "primary"}
      >
        <Paperclip aria-hidden="true" size={17} />
        {m.panel_send_proof()}
      </Button>
      <small className="text-center text-[12.5px] text-ink-muted">
        {m.panel_drop_limit()}
      </small>
    </div>
  );
}

/**
 * The bottom sheet's pinned action by the panel's primary (mockup 14, frame
 * E); a primary with no entry pins nothing, and the sheet then has no footer
 * at all.
 */
export const SHEET_FOOTER: Partial<
  Record<PanelPrimary, (props: FooterProps) => ReactNode>
> = {
  confirm: ({ className }) => <ConfirmButton className={className} />,
  share_receipt: (props) => <ReceiptFooter {...props} />,
  whatsapp_receipt: (props) => <ReceiptFooter {...props} />,
  receipt_pdf: (props) => <ReceiptFooter {...props} />,
  send_proof: (props) => <SendProofFooter {...props} />,
  whatsapp_charge: ({ className, contract, detail }) => (
    <ChargeLink
      className={className}
      contract={contract}
      detail={detail}
      today={todayISO()}
    />
  ),
};

/**
 * What the footer would pin for this installment, or null: the host asks
 * before handing the sheet a footer, so an empty one never shows. While the
 * reason of a dispute is being written, the confirm steps aside.
 */
export function useSheetPrimary(contract: ContractDetail): {
  detail: InstallmentDetail;
  primary: PanelPrimary;
} | null {
  const { contestOpen, installmentId } = usePanel();
  const { data: detail } = useQuery(installmentQueryOptions(installmentId));
  if (!detail) {
    return null;
  }
  const { primary } = panelView(panelInputOf(contract, detail));
  if (!(primary && SHEET_FOOTER[primary])) {
    return null;
  }
  if (primary === "confirm" && contestOpen) {
    return null;
  }
  return { detail, primary };
}

/** Only in the bottom sheet: the panel's main action, 48 px and the full width. */
export function SheetFooter({ contract }: { contract: ContractDetail }) {
  const pinned = useSheetPrimary(contract);
  if (!pinned) {
    return null;
  }
  return SHEET_FOOTER[pinned.primary]?.({
    className: "h-12 w-full text-[15px]",
    contract,
    detail: pinned.detail,
    primary: pinned.primary,
  });
}
