import { useSyncExternalStore } from "react";

/**
 * Whether the guided tour is on screen (mockup 20, B9). A tiny external
 * store: the empty states, Ajustes › Perfil and the first-visit check all
 * start the same tour, and the shell is where it is drawn.
 */
let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export const tourStore = {
  start() {
    open = true;
    emit();
  },
  close() {
    open = false;
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  isOpen: () => open,
};

export function useTourOpen(): boolean {
  return useSyncExternalStore(
    tourStore.subscribe,
    tourStore.isOpen,
    () => false
  );
}
