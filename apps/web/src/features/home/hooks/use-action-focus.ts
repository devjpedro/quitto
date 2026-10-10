import { useCallback, useLayoutEffect, useRef } from "react";
import { focusIndexAfterRemoval } from "../lib/action-focus";
import type { HomeAction } from "../types";

/**
 * An action takes its card out at once (optimistic), and the focused button
 * goes with it. Hands the focus to the card that took its place: its first
 * button. The last card is the page's: the home stops rendering the list, and
 * useFocusAfterLastAction hands the focus to the summary.
 */
export function useActionFocus(actions: HomeAction[]) {
  const sectionRef = useRef<HTMLElement>(null);
  const pending = useRef<string | null>(null);
  const previousIds = useRef<string[]>([]);

  useLayoutEffect(() => {
    const before = previousIds.current;
    const ids = actions.map((action) => action.id);
    previousIds.current = ids;
    const id = pending.current;
    const section = sectionRef.current;
    if (!(id && section) || ids.includes(id)) {
      return;
    }
    pending.current = null;
    const removedIndex = before.indexOf(id);
    if (removedIndex < 0) {
      return;
    }
    const index = focusIndexAfterRemoval(removedIndex, ids.length);
    if (index === null) {
      return;
    }
    const item = section.querySelector("ul")?.children[index];
    item?.querySelector<HTMLElement>("a[href], button:not(:disabled)")?.focus();
  }, [actions]);

  /** Called when a card's action starts. Only a focused button hands the focus on: a mouse tap that left it on the page keeps it there. */
  const onActionStart = useCallback((id: string) => {
    const section = sectionRef.current;
    pending.current = section?.contains(document.activeElement) ? id : null;
  }, []);

  return { sectionRef, onActionStart };
}
