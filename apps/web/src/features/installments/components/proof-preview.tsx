import { ArrowsOutSimple, DownloadSimple } from "@phosphor-icons/react";
import { useHydrated } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { InstallmentDetail, ProofItem } from "../types";
import { PANEL_TONE, type PanelMode } from "./panel-context";
import { FileRow, proofMeta } from "./proof-list";
import { ProofViewer } from "./proof-viewer";

/**
 * A PDF as the mockup draws it (mockup 14, frames A and G): its first page as
 * paper on the inner fill, the foot fading out (a mask, not a color). The
 * browser's viewer draws a dark gutter around the page (about 1.5% of its
 * width in Chrome, 3 to 5 px here): the frame is 8 px wider than the paper on
 * each side and above it, and the paper crops it. The viewer is a picture
 * here (inert): no wheel or focus scrolls it to its gutter, and "Abrir" opens
 * the viewer.
 */
function PdfPaper({ mode, proof }: { mode: PanelMode; proof: ProofItem }) {
  return (
    <div
      className={cn(
        "flex h-[186px] justify-center overflow-hidden rounded-control pt-3.5",
        PANEL_TONE[mode].inner
      )}
    >
      <div className="relative w-[62%] overflow-hidden rounded-t-[6px] bg-white [mask-image:linear-gradient(to_bottom,black_calc(100%-46px),transparent)]">
        <iframe
          className="absolute -top-2 -left-2 h-[calc(100%+1rem)] w-[calc(100%+1rem)]"
          inert
          // The page alone, fit to the width: no toolbar or side panel.
          src={`${proof.downloadUrl}#toolbar=0&navpanes=0&view=FitH`}
          title={proof.fileName}
        />
      </div>
    </div>
  );
}

/** What the proof looks like (owner's decision 4): the image, or the PDF in the browser's viewer off the phone. */
function Preview({ mode, proof }: { mode: PanelMode; proof: ProofItem }) {
  if (proof.mimeType.startsWith("image/")) {
    return (
      <img
        alt={m.panel_proof_alt({ file: proof.fileName })}
        className={cn(
          "h-[186px] w-full rounded-control object-contain",
          PANEL_TONE[mode].inner
        )}
        height={186}
        src={proof.downloadUrl}
        width={352}
      />
    );
  }
  if (mode === "bottom") {
    return null;
  }
  return <PdfPaper mode={mode} proof={proof} />;
}

/**
 * P4 (mockup 14, frame A): the proof to review. Only after hydration: the
 * server draws the column at every width, and a hidden iframe on a phone
 * would load the PDF for nothing, or download it on Android's Chrome (review
 * M11). Before that, only the file's line.
 */
export function ProofPreview({
  detail,
  mode,
}: {
  detail: InstallmentDetail;
  mode: PanelMode;
}) {
  const hydrated = useHydrated();
  const proof = detail.proofs.find((p) => p.state === "current");
  if (!proof) {
    return null;
  }
  const tone = PANEL_TONE[mode];
  return (
    <div
      className={cn("flex flex-col gap-3 rounded-card p-3.5", tone.block)}
      data-testid="proof-preview"
    >
      {hydrated ? <Preview mode={mode} proof={proof} /> : null}
      <FileRow
        actions={
          <>
            <ProofViewer
              proof={proof}
              trigger={
                <button
                  className={cn(
                    buttonVariants({ size: "sm", variant: "inset" }),
                    tone.innerButton
                  )}
                  type="button"
                >
                  <ArrowsOutSimple aria-hidden="true" size={16} />
                  {m.panel_proof_open()}
                </button>
              }
            />
            {/* On a phone the viewer has its own "Baixar": the line keeps its words whole. */}
            {mode === "bottom" ? null : (
              <a
                aria-label={m.panel_proof_download()}
                className={cn(
                  buttonVariants({ size: "sm", variant: "inset" }),
                  "w-11 px-0 md:w-9",
                  tone.innerButton
                )}
                href={proof.downloadUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <DownloadSimple aria-hidden="true" size={16} />
              </a>
            )}
          </>
        }
        meta={proofMeta(proof)}
        mode={mode}
        name={proof.fileName}
        proof={proof}
      />
    </div>
  );
}
