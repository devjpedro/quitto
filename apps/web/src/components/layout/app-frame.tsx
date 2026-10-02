import type { ReactNode } from "react";
import type { SessionIdentity } from "@/lib/session-resolver";
import { m } from "@/paraglide/messages.js";
import { Sidebar } from "./sidebar";
import { TabBar } from "./tab-bar";
import { TopBar } from "./top-bar";

export interface ShellProps {
  identity: SessionIdentity | null;
  onOpenSearch: () => void;
  unreadCount: number;
}

/** Desktop: sidebar + main panels on the warm canvas. Mobile: top bar + tab bar. */
export function AppFrame({
  children,
  ...shell
}: ShellProps & { children: ReactNode }) {
  return (
    <div
      className="min-h-dvh bg-surface-sunken font-sans text-ink md:bg-canvas md:p-3"
      id="app-shell"
    >
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-ink focus:px-4 focus:py-2 focus:text-ink-inverse"
        href="#conteudo"
      >
        {m.skip_to_content()}
      </a>
      <TopBar {...shell} />
      <div className="mx-auto flex max-w-[1440px] gap-3">
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
