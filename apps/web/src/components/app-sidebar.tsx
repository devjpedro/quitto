import { Link } from "@tanstack/react-router";
import {
  Bell,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMeQuery } from "@/hooks/use-me";
import { useUnreadCountQuery } from "@/hooks/use-notifications";
import { signOut } from "@/lib/auth-client";
import { formatUnreadCount } from "@/lib/format";

async function handleSignOut() {
  await signOut();
  window.location.href = "/login";
}

const WHITESPACE_RE = /\s+/;

function getInitials(name?: string): string {
  const parts = name?.trim().split(WHITESPACE_RE).filter(Boolean) ?? [];
  if (parts.length === 0) {
    return "?";
  }
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
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
        className="material-chrome sticky top-0 hidden h-screen w-56 flex-col border-border border-r sm:flex"
        style={{
          fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
        }}
      >
        <div className="flex items-center justify-between border-border border-b px-5 py-4">
          <Link
            aria-label="Ir para o início"
            className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to="/"
          >
            <Logo size={20} variant="brand" />
          </Link>
          <NotificationBell />
        </div>

        <nav
          aria-label="Navegação principal"
          className="flex flex-col gap-1 p-3"
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                activeProps={{ className: "active", "aria-current": "page" }}
                className="group relative flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-muted-foreground text-sm transition-colors duration-150 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity hover:border-border hover:bg-accent hover:text-foreground [&.active]:border-border-strong [&.active]:bg-card [&.active]:font-semibold [&.active]:text-primary-strong [&.active]:shadow-xs [&.active]:before:opacity-100"
                key={item.to}
                to={item.to}
              >
                <Icon
                  aria-hidden="true"
                  className="size-4 shrink-0 opacity-60 transition-opacity group-hover:opacity-80 [.active_&]:text-primary [.active_&]:opacity-100"
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

        {/* Rodapé: cartão de conta */}
        <div className="mt-auto border-border border-t p-3">
          <div className="flex items-center gap-2.5 rounded-md bg-secondary px-2.5 py-2">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 font-semibold text-primary-strong text-xs"
            >
              {getInitials(me?.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-foreground text-sm leading-tight">
                {me?.name ?? "..."}
              </div>
              <div className="truncate text-subtle-foreground text-xs leading-tight">
                {me?.email ?? ""}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 px-1">
            <button
              className="flex items-center gap-1.5 rounded-md px-1 py-1 text-muted-foreground text-xs transition-colors hover:text-destructive"
              onClick={handleSignOut}
              type="button"
            >
              <LogOut aria-hidden="true" className="size-3" />
              Sair
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Mobile bottom-nav */}
      <nav
        aria-label="Navegação principal"
        className="material-chrome fixed inset-x-0 bottom-0 z-30 flex border-border border-t sm:hidden"
        style={{
          fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
        }}
      >
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              activeProps={{ className: "active", "aria-current": "page" }}
              className="relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-muted-foreground transition-colors before:absolute before:inset-x-8 before:top-0 before:h-0.5 before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity [&.active]:text-primary-strong [&.active]:before:opacity-100"
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
