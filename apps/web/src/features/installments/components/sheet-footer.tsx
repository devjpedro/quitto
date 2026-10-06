import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ContractDetail } from "@/features/contracts/types";
import { installmentQueryOptions } from "../api";
import {
  type PanelPrimary,
  panelInputOf,
  panelView,
} from "../lib/panel-actions";
import type { InstallmentDetail } from "../types";
import { usePanel } from "./panel-context";
import { ReceiptPrimaryButton, useReceiptActions } from "./receipt-block";
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
 * The bottom sheet's pinned action by the panel's primary (mockup 14, frame
 * E). Task 10 adds "send_proof" and "whatsapp_charge"; a primary with no
 * entry pins nothing, and the sheet then has no footer at all.
 */
export const SHEET_FOOTER: Partial<
  Record<PanelPrimary, (props: FooterProps) => ReactNode>
> = {
  confirm: ({ className }) => <ConfirmButton className={className} />,
  share_receipt: (props) => <ReceiptFooter {...props} />,
  whatsapp_receipt: (props) => <ReceiptFooter {...props} />,
  receipt_pdf: (props) => <ReceiptFooter {...props} />,
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
