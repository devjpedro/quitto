import {
  createFileRoute,
  Outlet,
  redirect,
  useMatch,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { CommandPalette } from "@/components/command-palette";
import { ErrorFallback } from "@/components/error-fallback";
import { AppFrame } from "@/components/layout/app-frame";
import { visibleNotificationsTrigger } from "@/components/layout/notifications-trigger";
import { ContractMobileMenu } from "@/features/contracts/components/contract-menus";
import {
  useActiveContracts,
  useMomentMilestone,
  useNavCounts,
  useUnreadCount,
} from "@/features/home/shell-selectors";
import { NotificationsPanel } from "@/features/notifications/components/notifications-panel";
import {
  NotificationsPanelContext,
  useNotificationsPanel,
} from "@/features/notifications/hooks/use-notifications-panel";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useIdentity } from "@/hooks/use-identity";
import {
  clearIdentityCookie,
  usePersistIdentityCookie,
} from "@/hooks/use-identity-cookie";
import { useLocaleSync } from "@/hooks/use-locale-sync";
import { meQueryOptions, useMeQuery } from "@/hooks/use-me";
import { queryKeys } from "@/lib/query-keys";
import { isSessionLost } from "@/lib/session-gate";
import { getSessionSSR } from "@/lib/ssr-session";
import { m } from "@/paraglide/messages.js";

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
  const unreadCount = useUnreadCount();
  const moment = useMomentMilestone();
  const navCounts = useNavCounts();
  const activeContracts = useActiveContracts();
  const notifications = useNotificationsPanel();
  const navigate = useNavigate();
  // Registered ONCE here: this layout owns the global ⌘K shortcut.
  const { open: searchOpen, setOpen: setSearchOpen } = useCommandPalette();
  const sessionLost = isSessionLost(me.error);
  // A contract on a phone: the top bar goes back to the list and carries the
  // contract's "⋯" (decision 15: decided by the route, no width JS).
  const contractMatch = useMatch({
    from: "/_app/contracts/$id",
    shouldThrow: false,
  });

  useLocaleSync(me.data?.locale);
  usePersistIdentityCookie(me.data);

  useEffect(() => {
    if (sessionLost) {
      clearIdentityCookie();
      navigate({ to: "/login", search: { redirect: undefined } });
    }
  }, [sessionLost, navigate]);

  return (
    <NotificationsPanelContext value={notifications.show}>
      <AppFrame
        activeContracts={activeContracts}
        detail={
          contractMatch
            ? {
                backLabel: m.contract_back(),
                backTo: "/contracts",
                actions: (
                  <ContractMobileMenu contractId={contractMatch.params.id} />
                ),
              }
            : null
        }
        identity={identity}
        moment={moment}
        navCounts={navCounts}
        notificationsOpen={notifications.open}
        onOpenNotifications={notifications.show}
        onOpenSearch={() => setSearchOpen(true)}
        unreadCount={unreadCount}
      >
        <CommandPalette
          onOpenChange={setSearchOpen}
          onOpenNotifications={notifications.show}
          open={searchOpen}
        />
        <NotificationsPanel
          // Opened from the ⌘K palette, which leaves as the panel opens: back to the bell.
          fallbackFocus={visibleNotificationsTrigger}
          onOpenChange={notifications.setOpen}
          open={notifications.open}
          unreadCount={unreadCount}
        />
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          resetKeys={[identity?.id]}
        >
          <Outlet />
        </ErrorBoundary>
      </AppFrame>
    </NotificationsPanelContext>
  );
}
