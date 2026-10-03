import { Bell, MagnifyingGlass } from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/icon-button";
import { m } from "@/paraglide/messages.js";
import { AccountMenu } from "./account-menu";
import type { ShellProps } from "./app-frame";
import { notificationsLabel } from "./notifications-label";
import { Wordmark } from "./wordmark";

export function TopBar({
  identity,
  notificationsOpen,
  onOpenNotifications,
  onOpenSearch,
  unreadCount,
}: ShellProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-surface-sunken/90 px-4 pt-[calc(0.375rem+env(safe-area-inset-top))] pb-1.5 backdrop-blur md:hidden">
      <Wordmark />
      <div className="flex items-center gap-0.5">
        <IconButton
          icon={MagnifyingGlass}
          label={m.search_open_short()}
          onClick={onOpenSearch}
        />
        <IconButton
          aria-expanded={notificationsOpen}
          aria-haspopup="dialog"
          badge={unreadCount}
          icon={Bell}
          label={notificationsLabel(unreadCount)}
          onClick={onOpenNotifications}
          weight={notificationsOpen ? "fill" : "regular"}
        />
        <AccountMenu identity={identity} variant="avatar" />
      </div>
    </header>
  );
}
