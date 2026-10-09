import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { BackToTop } from "./back-to-top";

/**
 * The canvas column beside the white panel, from md: the sidebar, or the
 * wizard's and the invite's steps. The same box, so the logo and the
 * panel's edge never move between the app and focus mode (planner's
 * decision 17). The frame's height: 12 px on top, the bottom safe area or
 * 12 px below; a short screen scrolls it.
 */
export const SHELL_COLUMN =
  "sticky top-3 hidden h-[calc(100dvh_-_0.75rem_-_max(0.75rem,env(safe-area-inset-bottom)))] w-[232px] shrink-0 flex-col overflow-y-auto p-3 md:flex";

/**
 * The wordmark alone (phase 1.5, owner's decision 1): 24 px, 44 px tall.
 * With `link` it is a link (the sidebar's goes home); the focus ring is
 * inset so the column's overflow never clips it.
 */
export function ShellLogoRow({
  action,
  link,
}: {
  /** At the right of the logo, on the same line (the sidebar's "＋"). */
  action?: ReactNode;
  link?: { label: string; to: "/" };
}) {
  const logo = <Logo size={24} />;
  if (!link) {
    return <div className="flex h-11 shrink-0 items-center px-2.5">{logo}</div>;
  }
  return (
    <div className="flex shrink-0 items-center justify-between gap-2">
      <Link
        aria-label={link.label}
        className="flex h-11 items-center rounded-control px-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
        to={link.to}
      >
        {logo}
      </Link>
      {action}
    </div>
  );
}

const PANEL_HEIGHT =
  "md:h-[calc(100dvh_-_0.75rem_-_max(0.75rem,env(safe-area-inset-bottom)))]";

/**
 * Structure B (DIRECAO › Layout): the warm canvas, a column on it, and the
 * content in one white panel with 12 px of canvas around. `fit="page"` grows
 * with the content (the app; from md the panel scrolls inside the screen's height, and "Voltar ao topo" shows after a screen of scroll); `fit="screen"` is the screen's height and the
 * panel scrolls inside it (the wizard and the invite). Below md there is no
 * panel: `page-surfaces` makes a card the surface.
 */
export function ShellFrame({
  bottom,
  children,
  column,
  fit = "page",
  mainClassName,
  top,
}: {
  bottom?: ReactNode;
  children: ReactNode;
  column: ReactNode;
  fit?: "page" | "screen";
  mainClassName?: string;
  top?: ReactNode;
}) {
  return (
    <div
      className="min-h-dvh bg-surface-sunken pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] font-sans text-ink md:h-dvh md:overflow-hidden md:bg-canvas md:pt-3 md:pr-[max(0.75rem,env(safe-area-inset-right))] md:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      id="app-shell"
    >
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-[max(0.75rem,env(safe-area-inset-left))] focus:z-50 focus:rounded-control focus:bg-ink focus:px-4 focus:py-2 focus:text-ink-inverse"
        href="#conteudo"
      >
        {m.skip_to_content()}
      </a>
      {top}
      {/* No gap: the column's own p-3 is the 12 px of canvas before the panel. */}
      <div className="flex">
        {column}
        <main
          className={cn(
            "max-md:page-surfaces min-w-0 flex-1 focus:outline-none md:relative md:rounded-panel md:bg-surface",
            // From md the page does not scroll: the sidebar and the panel's four
            // corners stay, and the panel scrolls inside (mockup 20, B3).
            fit === "page"
              ? `${PANEL_HEIGHT} md:overflow-y-auto md:overscroll-contain`
              : `${PANEL_HEIGHT} md:overflow-hidden`,
            mainClassName
          )}
          id="conteudo"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
      {bottom}
      {fit === "page" ? <BackToTop target="conteudo" /> : null}
    </div>
  );
}
