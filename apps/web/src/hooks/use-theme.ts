import { useCallback, useSyncExternalStore } from "react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

function currentClassTheme(): Theme {
  if (typeof document === "undefined") {
    return "light";
  }
  const isDark = document.documentElement.classList.contains("dark");
  return isDark ? "dark" : "light";
}

function subscribe(cb: () => void): () => void {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => obs.disconnect();
}

/** Tema resolvido (lê a classe do <html>) + setter que persiste em cookie first-party. */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    currentClassTheme,
    () => "light"
  );
  const setTheme = useCallback((t: Theme) => {
    const oneYear = 60 * 60 * 24 * 365;
    // biome-ignore lint/suspicious/noDocumentCookie: cookie first-party para persistência de tema
    document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=${oneYear}; SameSite=Lax`;
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);
  return { theme, setTheme };
}
