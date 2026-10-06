import {
  createFileRoute,
  Outlet,
  redirect,
  useMatch,
} from "@tanstack/react-router";
import { ErrorBoundary } from "react-error-boundary";
import { CommandPalette } from "@/components/command-palette";
import { ErrorFallback } from "@/components/error-fallback";
import { AppFrame } from "@/components/layout/app-frame";
import { visibleNotificationsTrigger } from "@/components/layout/notifications-trigger";
import { ContractMobileMenu } from "@/features/contracts/components/contract-mobile-menu";
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
import { useSessionGate } from "@/hooks/use-session-gate";
import { seedSession } from "@/lib/session-route";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const status = await seedSession(context.queryClient);
    if (status === "anon") {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    // "unknown" (cold API): render the shell anyway; the client validates.
  },
  component: AppLayout,
});

function AppLayout() {
  useSessionGate();
  const identity = useIdentity();
  const unreadCount = useUnreadCount();
  const moment = useMomentMilestone();
  const navCounts = useNavCounts();
  const activeContracts = useActiveContracts();
  const notifications = useNotificationsPanel();
  // Registered ONCE here: this layout owns the global ⌘K shortcut.
  const { open: searchOpen, setOpen: setSearchOpen } = useCommandPalette();
  // A contract on a phone: the top bar goes back to the list and carries the
  // contract's "⋯" (decision 15: decided by the route, no width JS).
  const contractMatch = useMatch({
    from: "/_app/contracts/$id",
    shouldThrow: false,
  });

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
