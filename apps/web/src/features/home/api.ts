import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { NOTIFICATION_READ_KEY } from "@/features/notifications/api";
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
  const reading = client.isMutating({ mutationKey: NOTIFICATION_READ_KEY }) > 0;
  const cached = client.getQueryData<Home>(queryKeys.home);
  return {
    actionIds: pendingHomeActionIds(client),
    // The cache holds the optimistic time while the dismissal is in flight.
    dismissedAt: dismissing ? (cached?.onboarding.dismissedAt ?? null) : null,
    // And the optimistic count while a notification read is in flight.
    unreadCap: reading ? (cached?.unreadCount ?? null) : null,
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

function markReceived(action: InstallmentAction) {
  return unwrap(
    api.api
      .installments({ installmentId: action.installmentId })
      ["mark-received"].post()
  );
}

/** The approver marks the money as received (owner's decision 2): POST …/mark-received. */
export function useMarkReceivedFromHome() {
  return useHomeActionMutation(
    markReceived,
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
