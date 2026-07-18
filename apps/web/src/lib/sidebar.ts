export const SIDEBAR_COOKIE = "sidebar";
export type SidebarState = "collapsed" | "expanded";

const SIDEBAR_RE = /(?:^|;\s*)sidebar=(collapsed|expanded)(?:;|$)/;

/** Lê o estado da sidebar de um header Cookie cru. undefined se ausente/inválido. */
export function parseSidebarCookie(
  cookieHeader: string | null | undefined
): SidebarState | undefined {
  if (!cookieHeader) {
    return;
  }
  const match = cookieHeader.match(SIDEBAR_RE);
  return match ? (match[1] as SidebarState) : undefined;
}
