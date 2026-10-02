import { Bell, MagnifyingGlass } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { SessionIdentity } from "@/lib/session-resolver";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { AccountMenu } from "./account-menu";
import { type NavItem, PRIMARY_NAV } from "./nav-items";
import { Wordmark } from "./wordmark";

const LINK =
  "flex min-h-10 items-center gap-2.5 rounded-control px-3 text-ink text-sm transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand data-[status=active]:bg-ink data-[status=active]:text-ink-inverse";

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <Link activeOptions={{ exact: item.exact }} className={LINK} to={item.to}>
      {({ isActive }) => (
        <>
          <item.icon
            aria-hidden="true"
            size={18}
            weight={isActive ? "fill" : "regular"}
          />
          {item.label()}
        </>
      )}
    </Link>
  );
}

export function Sidebar({
  identity,
  unreadCount,
  onOpenSearch,
}: {
  identity: SessionIdentity | null;
  onOpenSearch: () => void;
  unreadCount: number;
}) {
  return (
    <aside className="sticky top-3 hidden h-[calc(100dvh-1.5rem)] w-[232px] shrink-0 flex-col rounded-panel bg-surface p-3 md:flex">
      <Wordmark className="px-2 py-1.5" />
      <button
        className="mt-4 flex h-10 items-center gap-2 rounded-control border border-line px-3 text-ink-muted text-sm transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onClick={onOpenSearch}
        type="button"
      >
        <MagnifyingGlass aria-hidden="true" size={16} />
        <span className="flex-1 text-left">{m.search_open()}</span>
        <span aria-hidden="true" className="font-mono text-xs">
          ⌘K
        </span>
      </button>
      <nav aria-label={m.nav_primary()} className="mt-4 flex flex-col gap-0.5">
        <p className="mb-1 px-3 text-ink-muted text-xs">
          {m.nav_section_wallet()}
        </p>
        {PRIMARY_NAV.map((item) => (
          <SidebarLink item={item} key={item.to} />
        ))}
        <p className="mt-4 mb-1 px-3 text-ink-muted text-xs">
          {m.nav_section_account()}
        </p>
        <Link
          aria-label={
            unreadCount > 0
              ? m.nav_notifications_unread({ count: unreadCount })
              : undefined
          }
          className={LINK}
          to="/notifications"
        >
          {({ isActive }) => (
            <>
              <Bell
                aria-hidden="true"
                size={18}
                weight={isActive ? "fill" : "regular"}
              />
              <span className="flex-1">{m.nav_notifications()}</span>
              {unreadCount > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "text-xs tabular-nums",
                    isActive ? "text-ink-inverse/70" : "text-ink-muted"
                  )}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </>
          )}
        </Link>
      </nav>
      <div className="mt-auto">
        <AccountMenu identity={identity} variant="full" />
      </div>
    </aside>
  );
}
