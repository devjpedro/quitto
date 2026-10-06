import type { ReactNode } from "react";
import type { SessionIdentity } from "@/lib/session-resolver";
import { m } from "@/paraglide/messages.js";
import type { MomentCardView } from "./moment-card";
import type { NavCounts } from "./nav-items";
import { Sidebar } from "./sidebar";
import type { SidebarContracts } from "./sidebar-contracts";
import { TabBar } from "./tab-bar";
import { TopBar } from "./top-bar";

export interface ShellProps {
  /** "Contratos ativos" in the sidebar: the 5 newest and the total; null while the home loads (a skeleton), none hides the group. */
  activeContracts: SidebarContracts | null;
  /**
   * A detail screen on a phone (DIRECAO › Layout): back instead of the logo,
   * the bell and the screen's own actions instead of search and avatar.
   */
  detail: {
    actions: ReactNode;
    backLabel: string;
    backTo: "/contracts";
  } | null;
  identity: SessionIdentity | null;
  /** The milestone of the moment (lime card at the foot of the sidebar); null hides it. */
  moment: MomentCardView | null;
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
 * Below md there is no panel: `page-surfaces` makes a card the surface and
 * what sits inside it the phone's inset step (`--page-inset`: the sunken
 * surface in light, the raised one in dark).
 *
 * viewport-fit=cover draws to the physical edges. A phone on its side is md+
 * with the notch at the left or the right: the frame keeps out of it (the
 * left inset before the sidebar, and at least 12 px of canvas on the right
 * and at the bottom, more when the safe area is larger).
 */
export function AppFrame({
  children,
  ...shell
}: ShellProps & { children: ReactNode }) {
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
      <TopBar {...shell} />
      {/* No gap: the sidebar's own p-3 is the 12 px of canvas before the panel. */}
      <div className="flex">
        <Sidebar {...shell} />
        <main
          className="max-md:page-surfaces min-w-0 flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] focus:outline-none md:min-h-[calc(100dvh_-_0.75rem_-_max(0.75rem,env(safe-area-inset-bottom)))] md:rounded-panel md:bg-surface md:pb-0"
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
