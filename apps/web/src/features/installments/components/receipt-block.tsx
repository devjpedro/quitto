import {
  Copy,
  FilePdf,
  LinkSimple,
  Receipt,
  ShareNetwork,
  WhatsappLogo,
} from "@phosphor-icons/react";
import type { MouseEvent } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { perspectiveOf } from "@/features/contracts/lib/contract-view";
import type { ContractDetail } from "@/features/contracts/types";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { useShareReceiptMutation } from "../api";
import {
  type PanelPrimary,
  panelInputOf,
  panelView,
} from "../lib/panel-actions";
import { receiptMessage, whatsappUrl } from "../lib/whatsapp-message";
import type { InstallmentDetail } from "../types";
import { PANEL_TONE, type PanelMode, usePanel } from "./panel-context";

const PROTOCOL_RE = /^https?:\/\//;

/** The other side's first name: the payer to whoever receives. */
function counterpartFirstName(contract: ContractDetail): string {
  const otherRole =
    perspectiveOf(contract.role) === "receive" ? "buyer" : "seller";
  const name =
    contract.participants.find((p) => p.role === otherRole)?.displayName ?? "";
  return name.split(" ")[0] ?? name;
}

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
    const created = await share.mutateAsync();
    if (!created) {
      toast.error(m.panel_receipt_failed());
    }
    return created?.url ?? null;
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
      linkUrl().then((url) => {
        if (url && win) {
          win.location.href = whatsappFor(url, "receive");
        } else {
          win?.close();
        }
      });
    },
  };
}

type ReceiptActions = ReturnType<typeof useReceiptActions>;

/** The receipt's main action, inline in the block and pinned in the bottom sheet's footer. */
export function ReceiptPrimaryButton({
  actions,
  className,
  contract,
  primary,
}: {
  actions: ReceiptActions;
  className?: string;
  contract: ContractDetail;
  primary: PanelPrimary;
}) {
  if (primary === "share_receipt") {
    return (
      <Button
        className={className}
        disabled={actions.pending}
        onClick={actions.shareReceipt}
      >
        <ShareNetwork aria-hidden="true" size={16} />
        {m.panel_receipt_share()}
      </Button>
    );
  }
  if (primary === "whatsapp_receipt") {
    return (
      <Button
        className={className}
        disabled={actions.pending}
        onClick={actions.sendWhatsapp}
      >
        <WhatsappLogo aria-hidden="true" size={16} />
        {m.panel_receipt_whatsapp_to({ name: counterpartFirstName(contract) })}
      </Button>
    );
  }
  return (
    <Button asChild className={className}>
      <a download href={actions.pdfHref} onClick={actions.guardLink}>
        <FilePdf aria-hidden="true" size={16} />
        {m.panel_receipt_pdf()}
      </a>
    </Button>
  );
}

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
  const whatsapp = actions.whatsappHref ? (
    <a
      // Beside the PDF when both fit, else on a row of its own: never squeezed.
      className={cn(secondary, "flex-[1_0_auto]")}
      href={actions.whatsappHref}
      onClick={actions.guardLink}
      rel="noopener noreferrer"
      target="_blank"
    >
      <WhatsappLogo aria-hidden="true" size={16} />
      {m.panel_receipt_whatsapp()}
    </a>
  ) : null;
  if (!(main || pdf || whatsapp)) {
    return null;
  }
  // Inline, the WhatsApp takes its own row under the main pair; in the
  // bottom sheet the main is in the footer, and it sits beside the PDF.
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {main}
      {pdf}
      {whatsapp && inline ? (
        <div className="flex w-full">{whatsapp}</div>
      ) : (
        whatsapp
      )}
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
