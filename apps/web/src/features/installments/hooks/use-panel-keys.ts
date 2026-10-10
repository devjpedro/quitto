import { useCallback } from "react";
import { usePanel } from "../components/panel-context";

/** A key press as React and the DOM both give it (the sheet hears React's, the column the DOM's). */
export interface PanelKeyEvent {
  altKey: boolean;
  ctrlKey: boolean;
  currentTarget: EventTarget | null;
  defaultPrevented: boolean;
  key: string;
  metaKey: boolean;
  preventDefault: () => void;
  target: EventTarget | null;
}

/** Typing keeps its arrows: a field, a text area or an editable element. */
function isTyping(target: HTMLElement): boolean {
  return (
    target.isContentEditable ||
    target.closest("input, textarea, select, [contenteditable]") !== null
  );
}

/**
 * The panel's keys (DIRECAO › Contrato): ↑ and ↓ walk between installments,
 * Esc closes (only in the column: in the sheet, Radix closes). Heard on the
 * wrapper that stays mounted (planner's decision 34). A key from a dialog
 * opened above the panel (a portal, so outside the wrapper's DOM but inside
 * its React tree) is the dialog's, as is one from a field. While a proof is on
 * its way the arrows stop.
 */
export function usePanelKeys({
  onClose,
  onNext,
  onPrev,
}: {
  onClose?: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const { busy } = usePanel();
  return useCallback(
    (event: PanelKeyEvent) => {
      const { currentTarget, target } = event;
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !(target instanceof HTMLElement) ||
        !(currentTarget instanceof Node && currentTarget.contains(target)) ||
        isTyping(target)
      ) {
        return;
      }
      if (event.key === "Escape" && onClose) {
        event.preventDefault();
        onClose();
        return;
      }
      if (busy) {
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        onPrev();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        onNext();
      }
    },
    [busy, onClose, onNext, onPrev]
  );
}
