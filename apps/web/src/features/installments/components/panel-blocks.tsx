import type { ReactNode } from "react";
import type { ContractRoute } from "@/features/contracts/hooks/use-contract-route";
import { perspectiveOf } from "@/features/contracts/lib/contract-view";
import type { ContractDetail } from "@/features/contracts/types";
import type { PanelBlock } from "../lib/panel-actions";
import type { InstallmentDetail } from "../types";
import { DisputeBlock } from "./dispute-block";
import type { PanelMode } from "./panel-context";
import { ProofList } from "./proof-list";
import { ProofPreview } from "./proof-preview";
import { ReceiptBlock } from "./receipt-block";
import { ReviewBlock } from "./review-block";

export interface PanelBlockProps {
  contract: ContractDetail;
  detail: InstallmentDetail;
  mode: PanelMode;
  route: ContractRoute;
}

/**
 * Each block the panel can show (panelView decides which, in order). Task 10
 * adds its own here: pix, upload, mark_paid_link, charge, mark_received and
 * reupload. A block with no entry draws nothing.
 */
export const PANEL_BLOCKS: Partial<
  Record<PanelBlock, (props: PanelBlockProps) => ReactNode>
> = {
  proof_review: ({ detail, mode }) => (
    <ProofPreview detail={detail} mode={mode} />
  ),
  review_actions: ({ contract, mode }) => (
    <ReviewBlock contract={contract} mode={mode} />
  ),
  receipt: ({ contract, detail, mode }) => (
    <ReceiptBlock contract={contract} detail={detail} mode={mode} />
  ),
  proofs: ({ contract, detail, mode }) => (
    <ProofList
      detail={detail}
      mine={perspectiveOf(contract.role) === "pay"}
      mode={mode}
    />
  ),
  dispute: ({ detail, route }) => (
    <DisputeBlock detail={detail} today={route.today} />
  ),
};
