import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useHydrated } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { invalidateContractViews } from "@/lib/invalidate-contract-views";
import { optimisticUpdate } from "@/lib/optimistic";
import { queryKeys } from "@/lib/query-keys";
import { m } from "@/paraglide/messages.js";
import {
  applyInstallment,
  type ContractWithInstallments,
  withAction,
  withOnboardingDismissed,
  withoutAction,
} from "./lib/home-cache";
import type {
  Home,
  HomeAction,
  InstallmentAction,
  InviteAction,
} from "./types";

export const homeQueryOptions = queryOptions({
  queryKey: queryKeys.home,
  queryFn: () => unwrap(api.api.home.get()),
  // The bell lives in the shell: refresh whenever the tab comes back, even
  // inside the global 60 s staleTime (there is no polling).
  refetchOnWindowFocus: "always",
});

/** Shared by every optimistic home action, so they can see each other in flight. */
const HOME_ACTION_KEY = ["home-action"] as const;

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

function contractIdOf(action: HomeAction): string | undefined {
  return action.kind === "invite" ? undefined : action.contractId;
}

function installmentIdOf(action: HomeAction): string | undefined {
  return action.kind === "invite" ? undefined : action.installmentId;
}

/**
 * Shared shape of the home's optimistic actions: the action leaves the home at
 * once and comes back if the API refuses (the global handler toasts the
 * error). Two rules keep quick taps on different cards from undoing each
 * other (concurrent optimistic updates):
 * - a failure puts back only its own action, never a snapshot taken before
 *   the other taps;
 * - only the last action in flight refetches the aggregates, since a refetch
 *   in the middle would bring back a card another tap is still removing.
 */
function useHomeActionMutation<TAction extends HomeAction, TResult>(
  mutationFn: (action: TAction) => Promise<TResult>,
  successMessage: string,
  onSuccess?: (result: TResult) => void
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: HOME_ACTION_KEY,
    mutationFn,
    meta: { successMessage },
    onMutate: async (action: TAction) => {
      await qc.cancelQueries({ queryKey: queryKeys.home });
      const index =
        qc
          .getQueryData<Home>(queryKeys.home)
          ?.actions.findIndex((item) => item.id === action.id) ?? -1;
      qc.setQueryData<Home>(
        queryKeys.home,
        (home) => home && withoutAction(home, action.id)
      );
      return { index };
    },
    onError: (_error, action, context) => {
      const index = context?.index ?? -1;
      if (index >= 0) {
        qc.setQueryData<Home>(
          queryKeys.home,
          (home) => home && withAction(home, action, index)
        );
      }
    },
    onSuccess: (result) => {
      onSuccess?.(result);
    },
    onSettled: (_result, _error, action) => {
      const installmentId = installmentIdOf(action);
      if (installmentId) {
        qc.invalidateQueries({
          queryKey: queryKeys.installment(installmentId),
        });
      }
      const contractId = contractIdOf(action);
      if (contractId) {
        qc.invalidateQueries({ queryKey: queryKeys.contract(contractId) });
      }
      // This mutation still counts as pending inside onSettled: 1 means "the last one".
      if (qc.isMutating({ mutationKey: HOME_ACTION_KEY }) === 1) {
        invalidateContractViews(qc);
      }
    },
  });
}

/**
 * The API answers installment mutations with the updated row: show it now in
 * the cached contract and in the installment's own detail (the drawer).
 */
function useApplyInstallment() {
  const qc = useQueryClient();
  return (installment: { contractId: string; id: string; status: string }) => {
    qc.setQueryData<ContractWithInstallments>(
      queryKeys.contract(installment.contractId),
      (contract) => applyInstallment(contract, installment)
    );
    qc.setQueryData<{ status: string }>(
      queryKeys.installment(installment.id),
      (detail) => detail && { ...detail, status: installment.status }
    );
  };
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

export function useDismissOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.me.onboarding.dismiss.post()),
    onMutate: () =>
      optimisticUpdate<Home>(qc, queryKeys.home, (home) =>
        home ? withOnboardingDismissed(home, new Date().toISOString()) : home
      ),
    onError: (_error, _variables, rollback) => {
      rollback?.();
    },
    onSuccess: ({ dismissedAt }) => {
      qc.setQueryData<Home>(queryKeys.home, (home) =>
        home ? withOnboardingDismissed(home, dismissedAt) : home
      );
    },
  });
}
