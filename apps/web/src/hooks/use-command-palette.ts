import { useCallback, useEffect, useState } from "react";

/**
 * Estado da paleta + atalho global ⌘K / Ctrl+K. Registrado UMA vez, no
 * `_app.tsx` — mesmo contrato do ⌘\ em `use-sidebar.ts`.
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
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return { open, setOpen };
}
