import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/**
 * The canvas column beside the white panel, from md: the sidebar, or the
 * wizard's and the invite's steps. The same box, so the logo and the
 * panel's edge never move between the app and focus mode (planner's
 * decision 17). The frame's height: 12 px on top, the bottom safe area or
 * 12 px below; a short screen scrolls it.
 */
export const SHELL_COLUMN =
  "sticky top-3 hidden h-[calc(100dvh_-_0.75rem_-_max(0.75rem,env(safe-area-inset-bottom)))] w-[232px] shrink-0 flex-col overflow-y-auto p-3 md:flex";

/** The wordmark alone (phase 1.5, owner's decision 1): 24 px, 44 px tall. */
export function ShellLogoRow() {
  return (
    <div className="flex h-11 items-center px-2.5">
      <Logo size={24} />
    </div>
  );
}

const PANEL_HEIGHT =
  "md:h-[calc(100dvh_-_0.75rem_-_max(0.75rem,env(safe-area-inset-bottom)))]";
const PANEL_MIN_HEIGHT =
  "md:min-h-[calc(100dvh_-_0.75rem_-_max(0.75rem,env(safe-area-inset-bottom)))]";

/**
 * Structure B (DIRECAO › Layout): the warm canvas, a column on it, and the
 * content in one white panel with 12 px of canvas around. `fit="page"` grows
 * with the content (the app); `fit="screen"` is the screen's height and the
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
      className="min-h-dvh bg-surface-sunken pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] font-sans text-ink md:bg-canvas md:pt-3 md:pr-[max(0.75rem,env(safe-area-inset-right))] md:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
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
            "max-md:page-surfaces min-w-0 flex-1 focus:outline-none md:rounded-panel md:bg-surface",
            fit === "page"
              ? PANEL_MIN_HEIGHT
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
    </div>
  );
}
