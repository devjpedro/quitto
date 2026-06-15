import { type RefObject, useRef } from "react";

/**
 * WCAG 2.4.3 (Focus Order): when a confirm dialog/sheet is opened from a Radix
 * DropdownMenuItem, the menu item unmounts on close and Radix Menu hands focus
 * back to its own trigger asynchronously (a macrotask `setTimeout`), so there is
 * no reliable `document.activeElement` to capture synchronously. Instead, hold a
 * stable ref to the always-mounted trigger button and restore focus to it
 * deterministically in the dialog's `onCloseAutoFocus`.
 *
 * Usage:
 *   const { triggerRef, restoreFocus } = useFocusRestore();
 *   <DropdownMenuTrigger asChild>
 *     <Button ref={triggerRef} ... />
 *   </DropdownMenuTrigger>
 *   <DialogContent onCloseAutoFocus={restoreFocus} ... />
 */
export function useFocusRestore<T extends HTMLElement = HTMLButtonElement>(): {
  triggerRef: RefObject<T | null>;
  restoreFocus: (event: Event) => void;
} {
  const triggerRef = useRef<T | null>(null);
  function restoreFocus(event: Event) {
    if (triggerRef.current?.isConnected) {
      event.preventDefault();
      triggerRef.current.focus();
    }
  }
  return { triggerRef, restoreFocus };
}
