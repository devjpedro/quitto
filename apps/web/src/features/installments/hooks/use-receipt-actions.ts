import { useNavigate } from "@tanstack/react-router";
import type { MouseEvent } from "react";
import { useCopy } from "@/hooks/use-copy";
import { ApiError } from "@/lib/api-client";
import { m } from "@/paraglide/messages.js";
import { useShareReceiptMutation } from "../api";
import { usePanel } from "../components/panel-context";
import type { InstallmentDetail } from "../types";

const TOKEN_TAIL_RE = /\/r\/([^/?#]+)/;

/**
 * What the receipt offers, shared by the block and the bottom sheet's footer:
 * "Abrir recibo" (the public page, in this tab, with the link created on
 * demand, once), the link's copy, and the PDF of whoever cannot make a link.
 * Each answers to the panel's lock (review I2 of Task 9): the second hit of a
 * double tap does nothing.
 */
export function useReceiptActions(detail: InstallmentDetail) {
  const { tryLock } = usePanel();
  const share = useShareReceiptMutation(detail.id);
  const copy = useCopy();
  const navigate = useNavigate();
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
    copyLink: async () => {
      if (!tryLock()) {
        return;
      }
      const link = await linkOf();
      if (link) {
        await copy(link.url, m.panel_link_copied());
      }
    },
    /** The receipt's page, in this tab: `from=app` gives it a "Voltar" (an installed app has no browser back). */
    openReceipt: async () => {
      if (!tryLock()) {
        return;
      }
      const link = await linkOf();
      if (link) {
        await navigate({
          params: { token: link.token },
          search: { from: "app" },
          to: "/r/$token",
        });
      }
    },
  };
}

export type ReceiptActions = ReturnType<typeof useReceiptActions>;
