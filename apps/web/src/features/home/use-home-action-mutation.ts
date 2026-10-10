import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { invalidateContractViews } from "@/lib/invalidate-contract-views";
import { queryKeys } from "@/lib/query-keys";
import {
  applyInstallment,
  type ContractWithInstallments,
  withAction,
  withoutAction,
} from "./lib/home-cache";
import type { Home, HomeAction } from "./types";

/** Shared by every optimistic home action, so they can see each other in flight. */
const HOME_ACTION_KEY = ["home-action"] as const;

/** Ids of the home actions whose optimistic mutation is still in flight. */
export function pendingHomeActionIds(client: QueryClient): string[] {
  return client
    .getMutationCache()
    .findAll({ mutationKey: HOME_ACTION_KEY, status: "pending" })
    .map((mutation) => (mutation.state.variables as HomeAction | undefined)?.id)
    .filter((id): id is string => id !== undefined);
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
 *   in the middle would bring back a card another tap is still removing (any
 *   other read in the middle goes through the home's queryFn, which keeps the
 *   leaving cards out).
 */
export function useHomeActionMutation<TAction extends HomeAction, TResult>(
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
export function useApplyInstallment() {
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
