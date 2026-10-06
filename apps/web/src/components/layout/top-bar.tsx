import { Bell, CaretLeft, MagnifyingGlass } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { IconButton } from "@/components/ui/icon-button";
import { m } from "@/paraglide/messages.js";
import { AccountMenu } from "./account-menu";
import type { ShellProps } from "./app-frame";
import { notificationsLabel } from "./notifications-label";
import { notificationsTrigger } from "./notifications-trigger";

/**
 * The phone's top bar. On a list: the logo, search, the bell and the avatar.
 * On a detail screen (`detail`): "‹ Contratos" where the logo was, then the
 * bell and the screen's own actions (DIRECAO › Layout › Celular, telas de
 * detalhe).
 */
export function TopBar({
  detail,
  identity,
  notificationsOpen,
  onOpenNotifications,
  onOpenSearch,
  unreadCount,
}: ShellProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-surface-sunken/90 px-4 pt-[calc(0.375rem+env(safe-area-inset-top))] pb-1.5 backdrop-blur md:hidden">
      {detail ? (
        // The caret sits 12 px from the edge, as the mockup's (14, frame D).
        <Link
          className="-ml-3 inline-flex h-11 items-center gap-0.5 rounded-control pr-3 pl-2 font-medium text-[15px] text-ink transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-[.97] motion-reduce:active:scale-100"
          to={detail.backTo}
        >
          <CaretLeft aria-hidden="true" size={20} />
          {detail.backLabel}
        </Link>
      ) : (
        <Logo size={22} />
      )}
      <div className="flex items-center gap-0.5">
        {detail ? null : (
          <IconButton
            icon={MagnifyingGlass}
            label={m.search_open_short()}
            onClick={onOpenSearch}
          />
        )}
        <IconButton
          aria-expanded={notificationsOpen}
          aria-haspopup="dialog"
          badge={unreadCount}
          icon={Bell}
          label={notificationsLabel(unreadCount)}
          onClick={onOpenNotifications}
          weight={notificationsOpen ? "fill" : "regular"}
          {...notificationsTrigger("top-bar")}
        />
        {detail ? (
          detail.actions
        ) : (
          <AccountMenu identity={identity} variant="avatar" />
        )}
      </div>
    </header>
  );
}
