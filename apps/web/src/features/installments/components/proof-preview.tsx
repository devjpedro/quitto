import { ArrowsOutSimple, DownloadSimple } from "@phosphor-icons/react";
import { useHydrated } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { InstallmentDetail, ProofItem } from "../types";
import { PANEL_TONE, type PanelMode } from "./panel-context";
import { FileRow, proofMeta } from "./proof-list";

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
  return (
    <iframe
      className="h-[186px] w-full rounded-control bg-white"
      // The page alone, fit to the width: no toolbar or side panel in 186 px.
      src={`${proof.downloadUrl}#toolbar=0&navpanes=0&view=FitH`}
      title={proof.fileName}
    />
  );
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
            <a
              className={cn(
                buttonVariants({ size: "sm", variant: "inset" }),
                tone.innerButton
              )}
              href={proof.downloadUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ArrowsOutSimple aria-hidden="true" size={16} />
              {m.panel_proof_open()}
            </a>
            {/* On a phone "Abrir" hands the file to the system's viewer,
                which saves and shares it: the line keeps its words whole. */}
            {mode === "bottom" ? null : (
              <a
                aria-label={m.panel_proof_download()}
                className={cn(
                  buttonVariants({ size: "sm", variant: "inset" }),
                  "w-11 px-0 md:w-9",
                  tone.innerButton
                )}
                download
                href={proof.downloadUrl}
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
