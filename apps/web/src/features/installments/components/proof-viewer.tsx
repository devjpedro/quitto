import { DownloadSimple, X } from "@phosphor-icons/react";
import { Dialog } from "radix-ui";
import { type ReactNode, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { ProofItem } from "../types";
import { proofMeta } from "./proof-list";

/** An image fit to the viewer; a click (or a pinch, which the browser does) zooms it, a click again fits it back. */
function ProofImage({ proof }: { proof: ProofItem }) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <div className={cn("flex size-full", zoomed && "overflow-auto")}>
      <button
        aria-label={
          zoomed ? m.proof_viewer_zoom_out() : m.proof_viewer_zoom_in()
        }
        className={cn(
          "m-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          zoomed
            ? "w-[200%] max-w-none shrink-0 cursor-zoom-out"
            : "size-full cursor-zoom-in"
        )}
        onClick={() => setZoomed((on) => !on)}
        type="button"
      >
        <img
          alt={m.panel_proof_alt({ file: proof.fileName })}
          className={cn(
            "mx-auto block",
            zoomed ? "h-auto w-full" : "size-full object-contain"
          )}
          height={800}
          src={proof.downloadUrl}
          width={1200}
        />
      </button>
    </div>
  );
}

function DownloadLink({
  className,
  proof,
}: {
  className?: string;
  proof: ProofItem;
}) {
  return (
    <a
      className={cn(
        buttonVariants({ size: "sm", variant: "inset" }),
        className
      )}
      href={proof.downloadUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      <DownloadSimple aria-hidden="true" size={16} />
      {m.proof_viewer_download()}
    </a>
  );
}

/** The browser's own PDF viewer; when it has none (some Safari and Firefox, most phones) the object's content is the notice with "Baixar". */
function ProofPdf({ proof }: { proof: ProofItem }) {
  const fallback = (
    <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-medium text-ink text-sm">
        {m.proof_viewer_pdf_fail()}
      </p>
      <DownloadLink proof={proof} />
    </div>
  );
  if (
    typeof navigator !== "undefined" &&
    navigator.pdfViewerEnabled === false
  ) {
    return fallback;
  }
  return (
    <object
      aria-label={proof.fileName}
      className="size-full"
      data={proof.downloadUrl}
      type="application/pdf"
    >
      {fallback}
    </object>
  );
}

/**
 * "Abrir" on the proof's preview: the file inside the app, no new tab. A big
 * dialog from md (frame radius, the float shadow), the whole screen on a
 * phone. The header carries the name, the size and who sent it, "Baixar" and
 * the close (✕ and Esc). The trigger is the "Abrir" button, so the focus
 * goes back to it.
 */
export function ProofViewer({
  proof,
  trigger,
}: {
  proof: ProofItem;
  trigger: ReactNode;
}) {
  const isImage = proof.mimeType.startsWith("image/");
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
        <Dialog.Content className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-surface text-ink focus:outline-none md:inset-6 md:rounded-frame md:shadow-float">
          <header className="flex shrink-0 items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 md:px-5 md:pt-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate font-semibold text-[15px]">
                {proof.fileName}
              </Dialog.Title>
              <Dialog.Description className="truncate text-ink-muted text-xs tabular-nums">
                {proofMeta(proof)}
              </Dialog.Description>
            </div>
            <DownloadLink proof={proof} />
            <Dialog.Close asChild>
              <IconButton
                className="bg-surface-card hover:bg-surface-card-hover"
                icon={X}
                label={m.sheet_close()}
              />
            </Dialog.Close>
          </header>
          <div className="mx-2 mb-2 min-h-0 flex-1 overflow-hidden rounded-card bg-surface-sunken pb-[env(safe-area-inset-bottom)] md:mx-3 md:mb-3">
            {isImage ? (
              <ProofImage proof={proof} />
            ) : (
              <ProofPdf proof={proof} />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
