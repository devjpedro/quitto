import { FileImage, FilePdf } from "@phosphor-icons/react";
import { INSTALLMENT_STATUS } from "@quitto/shared";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { formatFileSize } from "../lib/file-size";
import type { InstallmentDetail, ProofItem } from "../types";
import { PANEL_TONE, type PanelMode } from "./panel-context";

const firstName = (name: string | null) => (name ?? "").split(" ")[0] ?? "";

/** "184 KB · enviado por Rafael" (decision 29: the name, no article). */
export function proofMeta(proof: ProofItem): string {
  const size = formatFileSize(proof.sizeBytes, getLocale());
  return proof.uploadedByMe
    ? m.panel_proof_by_you({ size })
    : m.panel_proof_by({ size, name: firstName(proof.uploadedByName) });
}

/**
 * A proof's line: its kind on a tile, the name, the meta, and what the place
 * offers (open, download). The tile takes the fill one step off the block.
 */
export function FileRow({
  actions,
  meta,
  mode,
  name,
  proof,
  struck = false,
}: {
  actions?: ReactNode;
  meta: string;
  mode: PanelMode;
  name: ReactNode;
  proof: ProofItem;
  struck?: boolean;
}) {
  const KindIcon = proof.mimeType === "application/pdf" ? FilePdf : FileImage;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-control text-ink",
          PANEL_TONE[mode].inner
        )}
      >
        <KindIcon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[13.5px]",
            struck ? "text-ink-muted line-through" : "font-medium text-ink"
          )}
        >
          {name}
        </span>{" "}
        {/* A dispute's reason is someone's words: it wraps, never cut. */}
        <span
          className={cn(
            "block text-ink-muted text-xs tabular-nums",
            struck ? "break-words" : "truncate"
          )}
        >
          {meta}
        </span>
      </span>
      {actions}
    </div>
  );
}

function rowMeta(
  proof: ProofItem,
  detail: InstallmentDetail,
  count: number
): string {
  const size = formatFileSize(proof.sizeBytes, getLocale());
  if (proof.state === "disputed") {
    // With the dispute shown above (P6), its reason is not said twice.
    if (detail.dispute) {
      return proofMeta(proof);
    }
    return proof.disputeReason
      ? m.panel_proof_disputed({
          reason: m.panel_quote({ text: proof.disputeReason }),
        })
      : m.panel_proof_disputed_plain();
  }
  return count > 1 ? m.panel_proof_accepted({ size }) : proofMeta(proof);
}

/**
 * Every proof sent for this installment (mockup 14, P5 and P6): the one that
 * counted and the disputed ones, struck through. Each name opens the file.
 * The payer of a disputed installment reads "Seu envio".
 */
export function ProofList({
  detail,
  mine,
  mode,
}: {
  detail: InstallmentDetail;
  /** The payer's own upload on a disputed installment. */
  mine: boolean;
  mode: PanelMode;
}) {
  const count = detail.proofs.length;
  const title =
    mine && detail.status === INSTALLMENT_STATUS.disputed
      ? m.panel_my_proof_title()
      : m.panel_proofs_title();
  return (
    <div>
      <h3 className="mb-2 font-semibold text-[13px] text-ink">{title}</h3>
      <ul
        className={cn(
          "flex flex-col gap-2.5 rounded-card p-3.5",
          PANEL_TONE[mode].block
        )}
      >
        {detail.proofs.map((proof) => (
          <li key={proof.id}>
            <FileRow
              meta={rowMeta(proof, detail, count)}
              mode={mode}
              name={
                <a
                  className="rounded-[4px] underline-offset-[3px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  href={proof.downloadUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {proof.fileName}
                </a>
              }
              proof={proof}
              struck={proof.state === "disputed"}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
