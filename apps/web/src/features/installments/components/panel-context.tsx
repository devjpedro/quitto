import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useActionLock } from "@/hooks/use-action-lock";
import { useProofUpload } from "../hooks/use-proof-upload";
import { PROOF_ACCEPT } from "../lib/proof-file";

/** Where the panel is drawn: the column from lateral, the floating sheet from md, the bottom sheet below. */
export type PanelMode = "docked" | "side" | "bottom";

/**
 * The fills by mode (mockup 14: --blk, --btn, --btn-in). The docked column is
 * filled (surface-card), so a block inside it is white and what sits in the
 * block steps back to the card; on a white sheet it is the other way round.
 * A button outside a block takes the block's fill.
 */
export const PANEL_TONE: Record<
  PanelMode,
  { block: string; button: string; inner: string; innerButton: string }
> = {
  docked: {
    block: "bg-surface-inset",
    inner: "bg-surface-card",
    button: "bg-surface-inset hover:bg-surface-inset-hover",
    innerButton: "bg-surface-card hover:bg-surface-card-hover",
  },
  side: {
    block: "bg-surface-card",
    inner: "bg-surface-inset",
    button: "bg-surface-card hover:bg-surface-card-hover",
    innerButton: "bg-surface-inset hover:bg-surface-inset-hover",
  },
  bottom: {
    block: "bg-surface-card",
    inner: "bg-surface-inset",
    button: "bg-surface-card hover:bg-surface-card-hover",
    innerButton: "bg-surface-inset hover:bg-surface-inset-hover",
  },
};

interface PanelState {
  /** Ignores ↑ ↓ while a proof is on its way (reviews I4 and M12). */
  busy: boolean;
  /** Stops the work in flight when the panel closes: the upload's PUT. */
  cancelWork: () => void;
  chooseFile: () => void;
  contestOpen: boolean;
  contractId: string;
  /** When this installment's Pix code was copied ("código copiado às 14:02"). */
  copiedAt: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  installmentId: string;
  markCopied: () => void;
  setContestOpen: (open: boolean) => void;
  /**
   * One lock for the panel's actions (review I2): an optimistic confirm swaps
   * its button, in place, for "Compartilhar recibo", and the second hit of a
   * double tap must not create the public link.
   */
  tryLock: () => boolean;
  /** The proof on its way: the sheet's body and its footer read the same one. */
  upload: ReturnType<typeof useProofUpload>;
}

const PanelContext = createContext<PanelState | null>(null);

/**
 * What the sheet's body and its footer share. It does not remount when the
 * installment changes (planner's decision 34), so the per-installment state
 * is marked with the id and reads as the initial one for another installment.
 */
export function PanelProvider({
  children,
  contractId,
  installmentId,
}: {
  children: ReactNode;
  contractId: string;
  installmentId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [contest, setContest] = useState({ id: installmentId, open: false });
  const contestOpen = contest.id === installmentId && contest.open;
  const setContestOpen = useCallback(
    (open: boolean) => setContest({ id: installmentId, open }),
    [installmentId]
  );
  const [copied, setCopied] = useState({
    id: installmentId,
    at: null as string | null,
  });
  const copiedAt = copied.id === installmentId ? copied.at : null;
  const markCopied = useCallback(
    () => setCopied({ id: installmentId, at: new Date().toISOString() }),
    [installmentId]
  );
  const chooseFile = useCallback(() => fileInputRef.current?.click(), []);
  const tryLock = useActionLock();
  const upload = useProofUpload(contractId, installmentId);
  const busy = upload.state.phase === "uploading";
  const value = useMemo<PanelState>(
    () => ({
      busy,
      cancelWork: upload.cancel,
      chooseFile,
      contestOpen,
      contractId,
      copiedAt,
      fileInputRef,
      installmentId,
      markCopied,
      setContestOpen,
      tryLock,
      upload,
    }),
    [
      busy,
      chooseFile,
      contestOpen,
      contractId,
      copiedAt,
      installmentId,
      markCopied,
      setContestOpen,
      tryLock,
      upload,
    ]
  );
  const { pick } = upload;
  return (
    <PanelContext.Provider value={value}>
      {children}
      {/* One file chooser for the panel: the drop zone and the sheet's footer open it. */}
      <input
        accept={PROOF_ACCEPT}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            pick(file);
          }
          event.target.value = "";
        }}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
    </PanelContext.Provider>
  );
}

export function usePanel(): PanelState {
  const panel = useContext(PanelContext);
  if (!panel) {
    throw new Error("usePanel must be used inside a PanelProvider");
  }
  return panel;
}
