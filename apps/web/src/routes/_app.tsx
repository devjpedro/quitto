import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { CommandPalette } from "@/components/command-palette";
import { ErrorFallback } from "@/components/error-fallback";
import { AppFrame } from "@/components/layout/app-frame";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useIdentity } from "@/hooks/use-identity";
import { useLocaleSync } from "@/hooks/use-locale-sync";
import { meQueryOptions, useMeQuery } from "@/hooks/use-me";
import { useUnreadCountQuery } from "@/hooks/use-notifications";
import { queryKeys } from "@/lib/query-keys";
import { isSessionLost } from "@/lib/session-gate";
import { getSessionSSR } from "@/lib/ssr-session";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    // SSR only. On the client the session lives in the query cache and the
    // layout reacts to a 401; calling a server function here would cost a
    // browser → Vercel → API round-trip on every preload and click.
    if (typeof document !== "undefined") {
      return;
    }
    const session = await getSessionSSR();
    if (session.status === "anon") {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    if (session.status === "authed") {
      context.queryClient.setQueryData(queryKeys.session, session.identity);
      if (session.me) {
        context.queryClient.setQueryData(meQueryOptions.queryKey, session.me);
      }
    }
    // "unknown" (cold API): render the shell anyway; the client validates.
  },
  component: AppLayout,
});

function AppLayout() {
  const me = useMeQuery();
  const identity = useIdentity();
  const unread = useUnreadCountQuery();
  const navigate = useNavigate();
  // Registered ONCE here: this layout owns the global ⌘K shortcut.
  const { open: searchOpen, setOpen: setSearchOpen } = useCommandPalette();
  const sessionLost = isSessionLost(me.error);

  useLocaleSync(me.data?.locale);

  useEffect(() => {
    if (sessionLost) {
      navigate({ to: "/login", search: { redirect: undefined } });
    }
  }, [sessionLost, navigate]);

  return (
    <AppFrame
      identity={identity}
      onOpenSearch={() => setSearchOpen(true)}
      unreadCount={unread.data?.count ?? 0}
    >
      <CommandPalette onOpenChange={setSearchOpen} open={searchOpen} />
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        resetKeys={[identity?.id]}
      >
        <Outlet />
      </ErrorBoundary>
    </AppFrame>
  );
}
