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
  /** Ignores ↑ ↓ while a proof is on its way (Task 10). */
  busy: boolean;
  /** Stops the work in flight when the panel closes (Task 10: the upload). */
  cancelWork: () => void;
  chooseFile: () => void;
  contestOpen: boolean;
  contractId: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  installmentId: string;
  setContestOpen: (open: boolean) => void;
  /**
   * One lock for the panel's actions (review I2): an optimistic confirm swaps
   * its button, in place, for "Compartilhar recibo", and the second hit of a
   * double tap must not create the public link.
   */
  tryLock: () => boolean;
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
  const chooseFile = useCallback(() => fileInputRef.current?.click(), []);
  const tryLock = useActionLock();
  const value = useMemo<PanelState>(
    () => ({
      busy: false,
      cancelWork: () => undefined,
      chooseFile,
      contestOpen,
      contractId,
      fileInputRef,
      installmentId,
      setContestOpen,
      tryLock,
    }),
    [
      chooseFile,
      contestOpen,
      contractId,
      installmentId,
      setContestOpen,
      tryLock,
    ]
  );
  return (
    <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
  );
}

export function usePanel(): PanelState {
  const panel = useContext(PanelContext);
  if (!panel) {
    throw new Error("usePanel must be used inside a PanelProvider");
  }
  return panel;
}
