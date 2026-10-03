import type { ReactNode } from "react";
import type { SessionIdentity } from "@/lib/session-resolver";
import { m } from "@/paraglide/messages.js";
import type { NavCounts } from "./nav-items";
import { Sidebar } from "./sidebar";
import { TabBar } from "./tab-bar";
import { TopBar } from "./top-bar";

export interface ShellProps {
  identity: SessionIdentity | null;
  /** The milestone of the moment, as text (lime card at the foot of the sidebar); null hides it. */
  moment: { detail: string; title: string } | null;
  /** The numbers next to "Agora" and "Contratos" in the sidebar; 0 hides one. */
  navCounts: NavCounts;
  notificationsOpen: boolean;
  onOpenNotifications: () => void;
  onOpenSearch: () => void;
  unreadCount: number;
}

/**
 * Desktop (structure B, mockup 12): the sidebar sits on the warm canvas, held
 * to the left edge, and only the content is a white panel. No max width: the
 * frame follows the screen with 12 px of canvas around the panel, and the
 * content grows by columns (DIRECAO › Layout). Mobile: top bar + tab bar.
 */
export function AppFrame({
  children,
  ...shell
}: ShellProps & { children: ReactNode }) {
  return (
    <div
      className="min-h-dvh bg-surface-sunken font-sans text-ink md:bg-canvas md:py-3 md:pr-3"
      id="app-shell"
    >
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-ink focus:px-4 focus:py-2 focus:text-ink-inverse"
        href="#conteudo"
      >
        {m.skip_to_content()}
      </a>
      <TopBar {...shell} />
      {/* No gap: the sidebar's own p-3 is the 12 px of canvas before the panel. */}
      <div className="flex">
        <Sidebar {...shell} />
        <main
          className="min-w-0 flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] focus:outline-none md:min-h-[calc(100dvh-1.5rem)] md:rounded-panel md:bg-surface md:pb-0"
          id="conteudo"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
      <TabBar />
    </div>
  );
}
