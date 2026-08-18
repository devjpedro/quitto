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

/**
 * ARIA APG (alertdialog): um diálogo de confirmação abre com o foco na opção
 * MENOS destrutiva. Nos nossos diálogos de confirmação o botão destrutivo vem
 * primeiro no DOM, então o autofocus padrão do Radix — o primeiro tabbable do
 * content — cairia justamente nele, e um Enter solto logo depois de abrir
 * executaria a ação irreversível. Isso só ficou alcançável quando o "Fechar"
 * saiu do começo da ordem de tab (ver `dialog.tsx`).
 *
 * `autoFocus` no botão NÃO resolve aqui: estes diálogos abrem de DENTRO de
 * outro escopo de foco do Radix (a gaveta da parcela, o DropdownMenu de ações),
 * e a armadilha do escopo de fora devolve o foco para si antes de o escopo de
 * dentro pausá-la — o `autoFocus` do React roda na fase de layout, cedo demais.
 * O `onOpenAutoFocus` roda dentro do fluxo do próprio Radix, já com o escopo de
 * fora pausado.
 *
 * Como o `restoreFocus` acima, só chama `preventDefault()` quando tem alvo vivo:
 * um `preventDefault()` sem alvo deixaria o foco no <body> e quebraria a
 * armadilha de foco inteira.
 *
 * Usage:
 *   const { focusRef, focusOnOpen } = useFocusOnOpen();
 *   <DialogContent onOpenAutoFocus={focusOnOpen} ... />
 *     <Button ref={focusRef} variant="outline">Cancelar</Button>
 */
export function useFocusOnOpen<T extends HTMLElement = HTMLButtonElement>(): {
  focusOnOpen: (event: Event) => void;
  focusRef: RefObject<T | null>;
} {
  const focusRef = useRef<T | null>(null);
  function focusOnOpen(event: Event) {
    if (focusRef.current?.isConnected) {
      event.preventDefault();
      focusRef.current.focus();
    }
  }
  return { focusOnOpen, focusRef };
}
