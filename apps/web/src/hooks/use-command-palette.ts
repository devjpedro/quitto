import { useCallback, useEffect, useState } from "react";

/**
 * Estado da paleta + atalho global ⌘K / Ctrl+K. Registrado UMA vez, no
 * `_app.tsx`: um 2º listener faria o toggle se anular.
 */
export function useCommandPalette(): {
  open: boolean;
  setOpen: (v: boolean) => void;
} {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        // ⌘K é "focar a busca" no Chrome/Firefox — precisa do preventDefault.
        e.preventDefault();
        toggle();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    // O `data-hydrated` do __root não basta para o E2E: o `_app` hidrata
    // depois (chunk da rota) ou nem montou ainda (navegação vinda do /login).
    // Este marca o instante exato em que o atalho passa a responder.
    document.documentElement.setAttribute("data-shortcuts-ready", "true");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.documentElement.removeAttribute("data-shortcuts-ready");
    };
  }, [toggle]);

  return { open, setOpen };
}
