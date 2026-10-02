import { Bell, MagnifyingGlass } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { IconButton } from "@/components/ui/icon-button";
import type { SessionIdentity } from "@/lib/session-resolver";
import { m } from "@/paraglide/messages.js";
import { AccountMenu } from "./account-menu";
import { Wordmark } from "./wordmark";

export function TopBar({
  identity,
  unreadCount,
  onOpenSearch,
}: {
  identity: SessionIdentity | null;
  onOpenSearch: () => void;
  unreadCount: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-surface-sunken/90 px-4 py-1.5 backdrop-blur md:hidden">
      <Wordmark />
      <div className="flex items-center gap-0.5">
        <IconButton
          icon={MagnifyingGlass}
          label={m.search_open_short()}
          onClick={onOpenSearch}
        />
        <IconButton
          asChild
          badge={unreadCount}
          icon={Bell}
          label={
            unreadCount > 0
              ? m.nav_notifications_unread({ count: unreadCount })
              : m.nav_notifications()
          }
        >
          <Link to="/notifications" />
        </IconButton>
        <AccountMenu identity={identity} variant="avatar" />
      </div>
    </header>
  );
}
