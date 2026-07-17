import { useCallback, useEffect, useSyncExternalStore } from "react";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";

const APP_SHELL_ID = "app-shell";

function getAppShell(): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  return document.getElementById(APP_SHELL_ID);
}

function currentCollapsed(): boolean {
  return getAppShell()?.dataset.sidebar === "collapsed";
}

function subscribe(cb: () => void): () => void {
  const target = getAppShell() ?? document.documentElement;
  const obs = new MutationObserver(cb);
  obs.observe(target, {
    attributes: true,
    attributeFilter: ["data-sidebar"],
  });
  return () => obs.disconnect();
}

/**
 * Estado colapsado da sidebar (lê `data-sidebar` do #app-shell) + setter que
 * persiste em cookie first-party e alterna o atributo no shell. Registra
 * o atalho ⌘\ / Ctrl+\ para toggle global.
 */
export function useSidebar(): {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggle: () => void;
} {
  const collapsed = useSyncExternalStore<boolean>(
    subscribe,
    currentCollapsed,
    () => false
  );

  const setCollapsed = useCallback((v: boolean) => {
    const oneYear = 60 * 60 * 24 * 365;
    const state = v ? "collapsed" : "expanded";
    // biome-ignore lint/suspicious/noDocumentCookie: cookie first-party para persistência do estado da sidebar
    document.cookie = `${SIDEBAR_COOKIE}=${state}; path=/; max-age=${oneYear}; SameSite=Lax`;
    getAppShell()?.setAttribute("data-sidebar", state);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed(!currentCollapsed());
  }, [setCollapsed]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "\\" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return { collapsed, setCollapsed, toggle };
}
