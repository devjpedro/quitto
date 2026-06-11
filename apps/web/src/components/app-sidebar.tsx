import { Link } from "@tanstack/react-router";
import { FileText, LayoutDashboard, LogOut } from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";

async function handleSignOut() {
  await signOut();
  window.location.href = "/login";
}

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/contracts", label: "Contratos", icon: FileText },
] as const;

export function AppSidebar() {
  const { data: session } = useSession();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden w-56 flex-col border-border border-r bg-card sm:flex"
        style={{
          fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
        }}
      >
        <div className="border-border border-b px-5 py-5">
          <span className="select-none font-extrabold text-lg text-primary tracking-tight">
            ◷ Quitto
          </span>
        </div>

        <nav
          aria-label="Navegação principal"
          className="flex flex-col gap-0.5 p-3"
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-muted-foreground text-sm transition-colors duration-150 hover:border-border hover:bg-muted hover:text-foreground [&.active]:border-primary/20 [&.active]:bg-primary/8 [&.active]:font-semibold [&.active]:text-primary"
                key={item.to}
                to={item.to}
              >
                <Icon
                  aria-hidden="true"
                  className="size-4 shrink-0 opacity-60 transition-opacity group-hover:opacity-80 [.active_&]:opacity-100"
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-border border-t p-3">
          <div className="mb-1 truncate px-1 font-medium text-foreground text-sm leading-tight">
            {session?.user.name ?? "..."}
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

      {/* Mobile bottom-nav — icons with sr-only labels for a11y, sm:hidden keeps it off desktop */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-border border-t bg-card sm:hidden"
        style={{
          fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
        }}
      >
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              aria-label={item.label}
              className="flex min-h-[44px] flex-1 flex-col items-center justify-center py-2 text-muted-foreground transition-colors [&.active]:text-primary"
              key={item.to}
              to={item.to}
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
