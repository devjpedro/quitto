import { Link } from "@tanstack/react-router";
import {
  Bell,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { useMeQuery } from "@/hooks/use-me";
import { useUnreadCountQuery } from "@/hooks/use-notifications";
import { signOut } from "@/lib/auth-client";
import { formatUnreadCount } from "@/lib/format";

async function handleSignOut() {
  await signOut();
  window.location.href = "/login";
}

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/contracts", label: "Contratos", icon: FileText },
  { to: "/notifications", label: "Notificações", icon: Bell },
  { to: "/settings", label: "Conta", icon: Settings },
] as const;

export function AppSidebar() {
  const { data: me } = useMeQuery();
  const { data: counter } = useUnreadCountQuery();
  const unread = counter?.count ?? 0;

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="sticky top-0 hidden h-screen w-56 flex-col border-border border-r bg-card sm:flex"
        style={{
          fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
        }}
      >
        <div className="flex items-center justify-between border-border border-b px-5 py-4">
          <span className="select-none font-extrabold text-lg text-primary tracking-tight">
            ◷ Quitto
          </span>
          <NotificationBell />
        </div>

        <nav
          aria-label="Navegação principal"
          className="flex flex-col gap-0.5 p-3"
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                activeProps={{ className: "active", "aria-current": "page" }}
                className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-muted-foreground text-sm transition-colors duration-150 hover:border-border hover:bg-muted hover:text-foreground [&.active]:border-primary/20 [&.active]:bg-primary/8 [&.active]:font-semibold [&.active]:text-primary"
                key={item.to}
                to={item.to}
              >
                <Icon
                  aria-hidden="true"
                  className="size-4 shrink-0 opacity-60 transition-opacity group-hover:opacity-80 [.active_&]:opacity-100"
                />
                {item.label}
                {item.to === "/notifications" && unread > 0 ? (
                  <span
                    aria-hidden="true"
                    className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-semibold text-[10px] text-primary-foreground leading-5"
                  >
                    {formatUnreadCount(unread)}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-border border-t p-3">
          <div className="mb-1 truncate px-1 font-medium text-foreground text-sm leading-tight">
            {me?.name ?? "..."}
          </div>
          <button
            className="flex items-center gap-1.5 rounded-md px-1 py-1 text-muted-foreground text-xs transition-colors hover:text-destructive"
            onClick={handleSignOut}
            type="button"
          >
            <LogOut aria-hidden="true" className="size-3" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile bottom-nav */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 flex border-border border-t bg-card sm:hidden"
        style={{
          fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
        }}
      >
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              activeProps={{ className: "active", "aria-current": "page" }}
              className="relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-muted-foreground transition-colors [&.active]:text-primary"
              key={item.to}
              to={item.to}
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              {item.to === "/notifications" && unread > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute top-2 left-1/2 ml-2 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1 font-semibold text-[10px] text-primary-foreground leading-none ring-1 ring-background"
                >
                  {formatUnreadCount(unread)}
                </span>
              ) : null}
              <span className="mt-0.5 text-[10px] leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
