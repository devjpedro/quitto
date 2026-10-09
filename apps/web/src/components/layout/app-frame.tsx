import { useLocation } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef } from "react";
import type { SessionIdentity } from "@/lib/session-resolver";
import type { MomentCardView } from "./moment-card";
import type { NavCounts } from "./nav-items";
import { ShellFrame } from "./shell-frame";
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
    backTo: "/contracts" | "/settings";
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
 * From md the block scrolls, not the page: after a link of the sidebar or of the
 * tab bar the focus would stay there, and Space, PageDown and ↓ would scroll
 * nothing. So a change of page hands the focus to the block, but only when it
 * was on the navigation (or nowhere): a field the person is typing in is theirs.
 */
function useFocusBlockOnNavigate() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) {
      return;
    }
    previous.current = pathname;
    const active = document.activeElement;
    const onNavigation =
      active === null ||
      active === document.body ||
      active.closest("aside, nav") !== null;
    if (onNavigation) {
      document.getElementById("conteudo")?.focus({ preventScroll: true });
    }
  }, [pathname]);
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
  useFocusBlockOnNavigate();
  return (
    <ShellFrame
      bottom={<TabBar />}
      column={<Sidebar {...shell} />}
      mainClassName="pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0"
      top={<TopBar {...shell} />}
    >
      {children}
    </ShellFrame>
  );
}
