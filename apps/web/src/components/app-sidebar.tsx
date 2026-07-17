import { Link } from "@tanstack/react-router";
import {
  Bell,
  FileText,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMeQuery } from "@/hooks/use-me";
import { useUnreadCountQuery } from "@/hooks/use-notifications";
import { useTheme } from "@/hooks/use-theme";
import { signOut } from "@/lib/auth-client";
import { formatUnreadCount } from "@/lib/format";
import { cn } from "@/lib/utils";

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

/** Toggle do rail (PanelLeftClose recolher / PanelLeftOpen expandir) — vive na brand row, desktop-only. */
function SidebarToggleButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95"
      onClick={onToggle}
      type="button"
    >
      {collapsed ? (
        <PanelLeftOpen aria-hidden="true" className="size-4" />
      ) : (
        <PanelLeftClose aria-hidden="true" className="size-4" />
      )}
    </button>
  );
}

/** Rail-only: um icon-button que alterna claro/escuro (o segmentado é só na expandida). */
function ThemeIconToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      className="inline-grid size-8 shrink-0 place-items-center rounded-md border border-border bg-accent text-subtle-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      type="button"
    >
      {isDark ? (
        <Sun aria-hidden="true" className="size-4" />
      ) : (
        <Moon aria-hidden="true" className="size-4" />
      )}
    </button>
  );
}

/** Rail-only: ícone de sair, mesmo estilo dos demais ícones do rodapé colapsado. */
function SignOutIconButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label="Sair"
          className="inline-grid size-8 shrink-0 place-items-center rounded-md border border-border bg-accent text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95"
          onClick={handleSignOut}
          type="button"
        >
          <LogOut aria-hidden="true" className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">Sair</TooltipContent>
    </Tooltip>
  );
}

function notificationBadge(collapsed: boolean, unread: number) {
  if (unread <= 0) {
    return null;
  }
  if (collapsed) {
    return (
      <span
        aria-hidden="true"
        className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-background"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-semibold text-[10px] text-primary-foreground leading-5"
    >
      {formatUnreadCount(unread)}
    </span>
  );
}

const NAV_LINK_BASE =
  "group relative flex items-center rounded-lg border border-transparent text-muted-foreground text-sm transition-colors duration-150 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity hover:border-border hover:bg-accent hover:text-foreground [&.active]:border-border-strong [&.active]:bg-card [&.active]:font-semibold [&.active]:text-primary-strong [&.active]:shadow-xs [&.active]:before:opacity-100";
const NAV_ICON_CLASS =
  "size-4 shrink-0 opacity-60 transition-opacity group-hover:opacity-80 [.active_&]:text-primary [.active_&]:opacity-100";

export function AppSidebar({
  collapsed = false,
  onToggle = () => {
    // no-op default: só usado quando o consumidor não controla o toggle
  },
}: {
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const { data: me } = useMeQuery();
  const { data: counter } = useUnreadCountQuery();
  const unread = counter?.count ?? 0;

  return (
    <TooltipProvider>
      {/* Desktop sidebar */}
      <aside className="material-chrome sticky top-0 hidden h-screen flex-col border-border border-r sm:flex">
        <div
          className={cn(
            "flex border-border border-b",
            collapsed
              ? "flex-col items-center gap-2 px-2 py-3"
              : "items-center justify-between px-5 py-4"
          )}
        >
          <Link
            aria-label="Ir para o início"
            className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to="/"
          >
            {collapsed ? (
              <LogoMark size={22} variant="brand" />
            ) : (
              <Logo size={20} variant="brand" />
            )}
          </Link>
          <div
            className={cn(
              "flex items-center",
              collapsed ? "flex-col gap-2" : "gap-1"
            )}
          >
            <NotificationBell />
            <SidebarToggleButton collapsed={collapsed} onToggle={onToggle} />
          </div>
        </div>

        <nav
          aria-label="Navegação principal"
          className={cn(
            "flex flex-col gap-1 p-3",
            collapsed && "items-center px-2"
          )}
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            const badge =
              item.to === "/notifications"
                ? notificationBadge(collapsed, unread)
                : null;

            const link = (
              <Link
                activeProps={{ className: "active", "aria-current": "page" }}
                className={cn(
                  NAV_LINK_BASE,
                  collapsed ? "size-10 justify-center" : "gap-3 px-3 py-2.5"
                )}
                key={item.to}
                to={item.to}
              >
                <Icon aria-hidden="true" className={NAV_ICON_CLASS} />
                <span className={cn(collapsed && "sr-only")}>{item.label}</span>
                {badge}
              </Link>
            );

            if (!collapsed) {
              return link;
            }

            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Rodapé: cartão de conta */}
        {collapsed ? (
          <div className="mt-auto flex flex-col items-center gap-3 border-border border-t p-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  aria-label="Conta"
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  to="/settings"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-8 items-center justify-center rounded-full bg-primary/12 font-semibold text-primary-strong text-xs"
                  >
                    {getInitials(me?.name)}
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                {me?.name ?? "Conta"}
              </TooltipContent>
            </Tooltip>
            <ThemeIconToggle />
            <SignOutIconButton />
          </div>
        ) : (
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
        )}
      </aside>

      {/* Mobile bottom-nav */}
      <nav
        aria-label="Navegação principal"
        className="material-chrome fixed inset-x-0 bottom-0 z-30 flex border-border border-t sm:hidden"
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
    </TooltipProvider>
  );
}
