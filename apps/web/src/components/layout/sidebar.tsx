import { Bell, GearSix, MagnifyingGlass } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { AccountMenu } from "./account-menu";
import type { ShellProps } from "./app-frame";
import { MomentCard } from "./moment-card";
import { type NavItem, PRIMARY_NAV } from "./nav-items";
import { notificationsLabel } from "./notifications-label";
import { notificationsTrigger } from "./notifications-trigger";
import { SHELL_COLUMN, ShellLogoRow } from "./shell-frame";
import { SidebarContractsGroup } from "./sidebar-contracts";

// On the canvas (structure B): hover with nav-hover, focus inside the row; the active row stays black.
// Its focus ring stays outside, on the canvas: inside, brand on the black row is 2.31:1 (1.73:1 dark).
const LINK =
  "flex min-h-10 items-center gap-2.5 rounded-control px-3 text-ink text-sm transition-colors hover:bg-nav-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:not-data-[status=active]:ring-inset data-[status=active]:bg-ink data-[status=active]:text-ink-inverse";

/** The number at the end of a row. Hidden from AT: the row's name carries it. */
function RowCount({ active, count }: { active: boolean; count: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-xs tabular-nums",
        // ink-inverse at 70% on the black row: 9.5:1 light, 6.2:1 dark (AA).
        active ? "text-ink-inverse/70" : "text-ink-muted"
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarLink({ count, item }: { count: number; item: NavItem }) {
  return (
    <Link
      activeOptions={{ exact: item.exact }}
      aria-label={count > 0 ? item.countLabel(count) : undefined}
      className={LINK}
      to={item.to}
    >
      {({ isActive }) => (
        <>
          <item.icon
            aria-hidden="true"
            size={18}
            weight={isActive ? "fill" : "regular"}
          />
          <span className="flex-1">{item.label()}</span>
          {count > 0 ? <RowCount active={isActive} count={count} /> : null}
        </>
      )}
    </Link>
  );
}

export function Sidebar({
  activeContracts,
  identity,
  moment,
  navCounts,
  notificationsOpen,
  onOpenNotifications,
  onOpenSearch,
  unreadCount,
}: ShellProps) {
  return (
    // The frame's height (12 px on top, the bottom safe area or 12 px below);
    // a short screen (a phone on its side) scrolls it, the account menu included.
    <aside className={SHELL_COLUMN}>
      <ShellLogoRow />
      <button
        className="group mt-4 flex h-10 items-center gap-2 rounded-control border border-transparent bg-surface px-3 text-ink-muted text-sm transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onClick={onOpenSearch}
        type="button"
      >
        <MagnifyingGlass aria-hidden="true" size={16} />
        <span className="flex-1 text-left">{m.search_open()}</span>
        {/* The mockup's 6 px key (rounded-md is the legacy 10 px here); on the field's hover it takes the field's resting surface, so it never melts into it. */}
        <span
          aria-hidden="true"
          className="rounded-[6px] bg-surface-sunken px-1.5 py-1 font-mono text-[11px] text-ink-muted leading-none transition-colors group-hover:bg-surface"
        >
          ⌘K
        </span>
      </button>
      <nav aria-label={m.nav_primary()} className="mt-4 flex flex-col gap-0.5">
        <p className="mb-1 px-3 text-ink-muted text-xs">
          {m.nav_section_wallet()}
        </p>
        {PRIMARY_NAV.map((item) => (
          <SidebarLink count={navCounts[item.id]} item={item} key={item.to} />
        ))}
        <p className="mt-4 mb-1 px-3 text-ink-muted text-xs">
          {m.nav_section_account()}
        </p>
        <button
          aria-expanded={notificationsOpen}
          aria-haspopup="dialog"
          aria-label={
            unreadCount > 0 ? notificationsLabel(unreadCount) : undefined
          }
          className={cn(LINK, notificationsOpen && "bg-surface")}
          onClick={onOpenNotifications}
          type="button"
          {...notificationsTrigger("sidebar")}
        >
          <Bell
            aria-hidden="true"
            size={18}
            weight={notificationsOpen ? "fill" : "regular"}
          />
          <span className="flex-1 text-left">{m.nav_notifications()}</span>
          {unreadCount > 0 ? (
            <RowCount active={false} count={unreadCount} />
          ) : null}
        </button>
        <Link activeOptions={{ exact: false }} className={LINK} to="/settings">
          {({ isActive }) => (
            <>
              <GearSix
                aria-hidden="true"
                size={18}
                weight={isActive ? "fill" : "regular"}
              />
              <span className="flex-1">{m.account_settings()}</span>
            </>
          )}
        </Link>
        <SidebarContractsGroup contracts={activeContracts} />
      </nav>
      <div className="mt-auto flex flex-col gap-3">
        {moment ? <MomentCard moment={moment} /> : null}
        <AccountMenu identity={identity} variant="full" />
      </div>
    </aside>
  );
}
