export const THEME_COOKIE = "theme";
export type Theme = "light" | "dark";

const THEME_RE = /(?:^|;\s*)theme=(light|dark)(?:;|$)/;

/** Lê o tema de um header Cookie cru. undefined se ausente/ inválido. */
export function parseThemeCookie(
  cookieHeader: string | null | undefined
): Theme | undefined {
  if (!cookieHeader) {
    return;
  }
  const match = cookieHeader.match(THEME_RE);
  return match ? (match[1] as Theme) : undefined;
}

/**
 * Script inline (roda no <head> antes do paint): se houver cookie usa ele,
 * senão segue prefers-color-scheme. Garante zero-flash inclusive na 1ª visita.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)theme=(light|dark)/);var t=m?m[1]:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;
