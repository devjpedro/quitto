import {
  createFileRoute,
  Outlet,
  redirect,
  useMatch,
} from "@tanstack/react-router";
import { type ComponentProps, lazy, Suspense, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { AppFrame } from "@/components/layout/app-frame";
import { visibleNotificationsTrigger } from "@/components/layout/notifications-trigger";
import { prefetchWhenIdle, warmMotion } from "@/components/ui/motion-scope";
import { ContractMobileMenu } from "@/features/contracts/components/contract-mobile-menu";
import {
  useActiveContracts,
  useMomentMilestone,
  useNavCounts,
  useUnreadCount,
} from "@/features/home/shell-selectors";
import {
  NotificationsPanelContext,
  useNotificationsPanel,
} from "@/features/notifications/hooks/use-notifications-panel";
import { useTourAutostart } from "@/features/tour/hooks/use-tour-autostart";
import { useTourOpen } from "@/features/tour/lib/tour-store";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useEverTrue } from "@/hooks/use-ever-true";
import { useIdentity } from "@/hooks/use-identity";
import { useSessionGate } from "@/hooks/use-session-gate";
import { m } from "@/paraglide/messages.js";

// Nothing here draws until the user asks (⌘K, the bell, the tour): the chunks
// come on first use, and the browser fetches them ahead when it is idle.
const loadPalette = () =>
  import("@/components/command-palette/command-palette").then((mod) => ({
    default: mod.CommandPalette,
  }));
const loadNotifications = () =>
  import("@/features/notifications/components/notifications-panel").then(
    (mod) => ({ default: mod.NotificationsPanel })
  );
const loadTour = () =>
  import("@/features/tour/components/tour-overlay").then((mod) => ({
    default: mod.TourOverlay,
  }));
const CommandPalette = lazy(loadPalette);
const NotificationsPanel = lazy(loadNotifications);
const TourOverlay = lazy(loadTour);

function prefetchOverlays() {
  return prefetchWhenIdle(() => {
    warmMotion();
    loadPalette();
    loadNotifications();
    loadTour();
  });
}

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context, location }) => {
    if (context.session === "anon") {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    // "unknown" (cold API): render the shell anyway; the client validates.
  },
  component: AppLayout,
});

function AppLayout() {
  useSessionGate();
  // The overlays and the animation engine are fetched once the page is quiet.
  useEffect(prefetchOverlays, []);
  useTourAutostart();
  const identity = useIdentity();
  const unreadCount = useUnreadCount();
  const moment = useMomentMilestone();
  const navCounts = useNavCounts();
  const activeContracts = useActiveContracts();
  const notifications = useNotificationsPanel();
  // Registered ONCE here: this layout owns the global ⌘K shortcut.
  const { open: searchOpen, setOpen: setSearchOpen } = useCommandPalette();
  const paletteMounted = useEverTrue(searchOpen);
  const notificationsMounted = useEverTrue(notifications.open);
  const tourMounted = useEverTrue(useTourOpen());
  // A contract on a phone: the top bar goes back to the list and carries the
  // contract's "⋯" (decision 15: decided by the route, no width JS).
  const contractMatch = useMatch({
    from: "/_app/contracts/$id",
    shouldThrow: false,
  });
  // A section of Ajustes on a phone is a screen: "‹ Ajustes" goes back to the list.
  const settingsMatch = useMatch({
    from: "/_app/settings/$section",
    shouldThrow: false,
  });

  let detail: ComponentProps<typeof AppFrame>["detail"] = null;
  if (contractMatch) {
    detail = {
      backLabel: m.contract_back(),
      backTo: "/contracts",
      actions: <ContractMobileMenu contractId={contractMatch.params.id} />,
    };
  } else if (settingsMatch) {
    detail = {
      backLabel: m.settings_title(),
      backTo: "/settings",
      actions: null,
    };
  }

  return (
    <NotificationsPanelContext value={notifications.show}>
      <AppFrame
        activeContracts={activeContracts}
        detail={detail}
        identity={identity}
        moment={moment}
        navCounts={navCounts}
        notificationsOpen={notifications.open}
        onOpenNotifications={notifications.show}
        onOpenSearch={() => setSearchOpen(true)}
        unreadCount={unreadCount}
      >
        <Suspense fallback={null}>
          {paletteMounted ? (
            <CommandPalette
              onOpenChange={setSearchOpen}
              onOpenNotifications={notifications.show}
              open={searchOpen}
            />
          ) : null}
          {notificationsMounted ? (
            <NotificationsPanel
              // Opened from the ⌘K palette, which leaves as the panel opens: back to the bell.
              fallbackFocus={visibleNotificationsTrigger}
              onOpenChange={notifications.setOpen}
              open={notifications.open}
              unreadCount={unreadCount}
            />
          ) : null}
          {tourMounted ? <TourOverlay /> : null}
        </Suspense>
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
