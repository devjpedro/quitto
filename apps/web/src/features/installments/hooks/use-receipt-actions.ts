import type { MouseEvent } from "react";
import { perspectiveOf } from "@/features/contracts/lib/contract-view";
import type { ContractDetail } from "@/features/contracts/types";
import { useCopy } from "@/hooks/use-copy";
import { ApiError } from "@/lib/api-client";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { useShareReceiptMutation } from "../api";
import { usePanel } from "../components/panel-context";
import { receiptMessage, whatsappUrl } from "../lib/whatsapp-message";
import type { InstallmentDetail } from "../types";

/**
 * What the receipt offers, shared by the block and the bottom sheet's footer:
 * the PDF, the public link (created on demand, once), the system's share
 * sheet or the clipboard, and the WhatsApp message in the sender's voice
 * ("Recebi…" or "Paguei…", review I7). Each answers to the panel's lock
 * (review I2 of Task 9): the second hit of a double tap does nothing.
 */
export function useReceiptActions(
  detail: InstallmentDetail,
  contract: ContractDetail
) {
  const { tryLock } = usePanel();
  const share = useShareReceiptMutation(detail.id);
  const copy = useCopy();
  const existing = detail.receiptShare?.url ?? null;
  const sender: "receive" | "pay" =
    perspectiveOf(contract.role) === "pay" ? "pay" : "receive";
  const whatsappFor = (url: string, perspective: "receive" | "pay") =>
    whatsappUrl(
      receiptMessage(
        {
          amountCents: detail.amountCents,
          contractTitle: contract.contract.title,
          installmentsCount: contract.installments.length,
          perspective,
          sequence: detail.sequence,
          url,
        },
        getLocale()
      )
    );
  /** The link, created when there is none yet; null (and said) when it could not be. */
  const linkUrl = async (): Promise<string | null> => {
    if (existing) {
      return existing;
    }
    try {
      return (await share.mutateAsync()).url;
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
    /** "Enviar no WhatsApp" when the link exists: a plain link in the sender's voice. */
    whatsappHref: existing ? whatsappFor(existing, sender) : null,
    /** A link (the PDF, the WhatsApp) answers to the lock too. */
    guardLink: (event: MouseEvent) => {
      if (!tryLock()) {
        event.preventDefault();
      }
    },
    copyLink: async () => {
      if (!tryLock()) {
        return;
      }
      const url = await linkUrl();
      if (url) {
        await copy(url, m.panel_link_copied());
      }
    },
    /** The system's share sheet where there is one, the clipboard elsewhere. */
    shareReceipt: async () => {
      if (!tryLock()) {
        return;
      }
      const url = await linkUrl();
      if (!url) {
        return;
      }
      if (typeof navigator.share === "function") {
        // Closing the share sheet rejects: nothing to say.
        await navigator.share({ url }).catch(() => undefined);
        return;
      }
      await copy(url, m.panel_link_copied());
    },
    /**
     * The window opens on the click, synchronously (one opened after an
     * await is blocked), and gets the wa.me once the link exists.
     */
    sendWhatsapp: () => {
      if (!tryLock()) {
        return;
      }
      const win = window.open("", "_blank");
      if (win) {
        win.opener = null;
      }
      linkUrl()
        .then((url) => {
          if (url && win) {
            win.location.href = whatsappFor(url, "receive");
          } else {
            win?.close();
          }
        })
        // A lost session (the 401 is rethrown) must not leave a blank tab behind.
        .catch(() => win?.close());
    },
  };
}

export type ReceiptActions = ReturnType<typeof useReceiptActions>;
