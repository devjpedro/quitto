import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useHydrated } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { m } from "@/paraglide/messages.js";
import {
  type PendingHomeWrites,
  withOnboardingDismissed,
  withPendingWrites,
} from "./lib/home-cache";
import type { Home, InstallmentAction, InviteAction } from "./types";
import {
  pendingHomeActionIds,
  useApplyInstallment,
  useHomeActionMutation,
} from "./use-home-action-mutation";

const HOME_DISMISS_KEY = ["home-dismiss"] as const;

function pendingHomeWrites(client: QueryClient): PendingHomeWrites {
  const dismissing = client.isMutating({ mutationKey: HOME_DISMISS_KEY }) > 0;
  return {
    actionIds: pendingHomeActionIds(client),
    // The cache holds the optimistic time while the dismissal is in flight.
    dismissedAt: dismissing
      ? (client.getQueryData<Home>(queryKeys.home)?.onboarding.dismissedAt ??
        null)
      : null,
  };
}

export const homeQueryOptions = queryOptions({
  queryKey: queryKeys.home,
  // A read that races an optimistic write (a focus refetch, another screen's
  // invalidation) may predate it and would bring back the card that is
  // leaving or the guide just dismissed: keep each write's effect until it
  // settles, matching the in-flight mutations by the action id they carry.
  queryFn: async ({ client }) =>
    withPendingWrites(
      await unwrap(api.api.home.get()),
      pendingHomeWrites(client)
    ),
  // The bell lives in the shell: refresh whenever the tab comes back, even
  // inside the global 60 s staleTime (there is no polling).
  refetchOnWindowFocus: "always",
  // That focus refetch runs on every screen: a failure there must not toast
  // over a page that does not show the home (the page shows its own state).
  meta: { silentRefetchError: true },
});

/**
 * Unread count for the shell badge, read from the home. Never throws: a
 * badge must not take down the shell. SSR and the hydration pass render 0,
 * because the streamed home may land before hydration and a badge that
 * differs from the server HTML would be a hydration mismatch.
 */
export function useUnreadCount(): number {
  const hydrated = useHydrated();
  const { data } = useQuery({
    ...homeQueryOptions,
    select: (home) => home.unreadCount,
    throwOnError: false,
  });
  return hydrated ? (data ?? 0) : 0;
}

function markPaid(action: InstallmentAction) {
  return unwrap(
    api.api
      .installments({ installmentId: action.installmentId })
      ["mark-paid"].post()
  );
}

export function useMarkPaidFromHome() {
  return useHomeActionMutation(
    markPaid,
    m.home_toast_marked_paid(),
    useApplyInstallment()
  );
}

/** Same endpoint as "Já paguei": the receiver who can also pay marks the money as received. */
export function useMarkReceivedFromHome() {
  return useHomeActionMutation(
    markPaid,
    m.home_toast_marked_received(),
    useApplyInstallment()
  );
}

export function useConfirmFromHome() {
  return useHomeActionMutation(
    (action: InstallmentAction) =>
      unwrap(
        api.api
          .installments({ installmentId: action.installmentId })
          .confirm.post()
      ),
    m.home_toast_confirmed(),
    useApplyInstallment()
  );
}

export function useAcceptInviteFromHome() {
  return useHomeActionMutation(
    (action: InviteAction) =>
      unwrap(api.api.invites({ token: action.token }).accept.post()),
    m.home_toast_invite_accepted()
  );
}

export function useDeclineInviteFromHome() {
  return useHomeActionMutation(
    (action: InviteAction) =>
      unwrap(api.api.invites({ token: action.token }).decline.post()),
    m.home_toast_invite_declined()
  );
}
/**
 * Hides the guide at once and keeps the server's time. A failure brings back
 * only the guide, never a snapshot of the whole home taken before other taps.
 */
export function useDismissOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: HOME_DISMISS_KEY,
    mutationFn: () => unwrap(api.api.me.onboarding.dismiss.post()),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queryKeys.home });
      const previous =
        qc.getQueryData<Home>(queryKeys.home)?.onboarding.dismissedAt ?? null;
      qc.setQueryData<Home>(
        queryKeys.home,
        (home) =>
          home && withOnboardingDismissed(home, new Date().toISOString())
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      qc.setQueryData<Home>(
        queryKeys.home,
        (home) =>
          home && withOnboardingDismissed(home, context?.previous ?? null)
      );
    },
    onSuccess: ({ dismissedAt }) => {
      qc.setQueryData<Home>(
        queryKeys.home,
        (home) => home && withOnboardingDismissed(home, dismissedAt)
      );
    },
  });
}
