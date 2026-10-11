import type { MouseEvent } from "react";
import { ApiError } from "@/lib/api-client";
import { useShareReceiptMutation } from "../api";
import { usePanel } from "../components/panel-context";
import type { InstallmentDetail } from "../types";

const TOKEN_TAIL_RE = /\/r\/([^/?#]+)/;

/**
 * What the receipt offers, shared by the block and the bottom sheet's footer:
 * "Abrir recibo" (the public page, in a new tab, with the link created on
 * demand, once) and the PDF.
 * Each answers to the panel's lock (review I2 of Task 9): the second hit of a
 * double tap does nothing.
 */
export function useReceiptActions(detail: InstallmentDetail) {
  const { tryLock } = usePanel();
  const share = useShareReceiptMutation(detail.id);
  const existing = detail.receiptShare?.url ?? null;
  /** The link, created when there is none yet; null (and said) when it could not be. */
  const linkOf = async (): Promise<{ token: string; url: string } | null> => {
    const token = existing?.match(TOKEN_TAIL_RE)?.[1];
    if (existing && token) {
      return { token, url: existing };
    }
    try {
      return await share.mutateAsync();
    } catch (error) {
      // The cache's onError already said why (meta.errorMessage); a lost
      // session goes to the gate, and nothing else is left to do here.
      if (error instanceof ApiError && error.httpStatus === 401) {
        throw error;
      }
      return null;
    }
  };
  return {
    existing,
    pdfHref: `/api/installments/${detail.id}/receipt.pdf`,
    pending: share.isPending,
    /** A link (the PDF) answers to the lock too. */
    guardLink: (event: MouseEvent) => {
      if (!tryLock()) {
        event.preventDefault();
      }
    },
    /**
     * The receipt's page, in a new tab. The window opens in the tap itself (a
     * popup opened after the await is blocked) and goes to the link once it
     * exists; with the link made already, the button is a plain anchor.
     */
    openReceipt: async () => {
      if (!tryLock()) {
        return;
      }
      const tab = window.open("", "_blank");
      const link = await linkOf().catch((error) => {
        tab?.close();
        throw error;
      });
      if (!link) {
        tab?.close();
        return;
      }
      if (tab) {
        tab.opener = null;
        tab.location.href = link.url;
      } else {
        window.open(link.url, "_blank", "noopener,noreferrer");
      }
    },
  };
}

export type ReceiptActions = ReturnType<typeof useReceiptActions>;
