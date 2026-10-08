import type { ReactNode } from "react";
import { perspectiveOf } from "@/features/contracts/lib/contract-view";
import type { ContractDetail } from "@/features/contracts/types";
import { m } from "@/paraglide/messages.js";
import type { PanelBlock } from "../lib/panel-actions";
import type { InstallmentDetail, PanelRoute } from "../types";
import { ChargeBlock } from "./charge-block";
import { DisputeBlock } from "./dispute-block";
import { MarkPaidLink } from "./mark-paid-link";
import { MarkReceivedBlock } from "./mark-received-block";
import type { PanelMode } from "./panel-context";
import { PixBlock } from "./pix-block";
import { ProofDropzone } from "./proof-dropzone";
import { ProofList } from "./proof-list";
import { ProofPreview } from "./proof-preview";
import { ReceiptBlock } from "./receipt-block";
import { ReviewBlock } from "./review-block";

export interface PanelBlockProps {
  contract: ContractDetail;
  detail: InstallmentDetail;
  mode: PanelMode;
  route: PanelRoute;
}

/**
 * Each block the panel can show (panelView decides which, in order). The Pix
 * block draws P2 itself when nobody has a key ("no_pix"). A block with no
 * entry draws nothing.
 */
export const PANEL_BLOCKS: Partial<
  Record<PanelBlock, (props: PanelBlockProps) => ReactNode>
> = {
  pix: (props) => <PixBlock {...props} />,
  upload: ({ mode }) => (
    <ProofDropzone mode={mode} title={m.panel_after_paying()} />
  ),
  reupload: ({ mode }) => (
    <ProofDropzone mode={mode} title={m.panel_resend_title()} />
  ),
  mark_paid_link: () => <MarkPaidLink />,
  charge: (props) => <ChargeBlock {...props} />,
  mark_received: ({ contract, mode }) => (
    <MarkReceivedBlock contract={contract} mode={mode} />
  ),
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
