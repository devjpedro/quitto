import { Link } from "@tanstack/react-router";
import { signOut, useSession } from "@/lib/auth-client";

async function handleSignOut() {
  await signOut();
  window.location.href = "/login";
}

export function AppSidebar() {
  const { data: session } = useSession();

  return (
    <aside className="flex w-56 flex-col border-border border-r bg-card p-4">
      <span className="mb-6 font-extrabold text-lg text-primary">◷ Quitto</span>
      <nav className="flex flex-col gap-1 text-sm">
        <Link
          className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted [&.active]:bg-primary/10 [&.active]:font-semibold [&.active]:text-primary"
          to="/"
        >
          Dashboard
        </Link>
      </nav>
      <div className="mt-auto border-border border-t pt-3">
        <p className="mb-2 truncate text-foreground text-sm">
          {session?.user.name ?? "..."}
        </p>
        <button
          className="text-muted-foreground text-sm underline"
          onClick={handleSignOut}
          type="button"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
