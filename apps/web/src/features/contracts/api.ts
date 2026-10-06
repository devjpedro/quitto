import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { invalidateContractViews } from "@/lib/invalidate-contract-views";
import { queryKeys } from "@/lib/query-keys";
import { m } from "@/paraglide/messages.js";
import type { ContractDetail } from "./types";

export const contractQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.contract(id),
    queryFn: () => unwrap(api.api.contracts({ id }).get()),
  });

/** "Editar título e descrição": the page shows the new text at once. */
export function useUpdateContractMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { description: string | null; title: string }) =>
      unwrap(api.api.contracts({ id }).patch(body)),
    meta: { successMessage: m.contract_toast_updated() },
    onSuccess: (row) => {
      qc.setQueryData<ContractDetail>(
        queryKeys.contract(id),
        (detail) =>
          detail && {
            ...detail,
            contract: {
              ...detail.contract,
              title: row.title,
              description: row.description,
            },
          }
      );
      invalidateContractViews(qc);
    },
  });
}

export function useDeleteContractMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.api.contracts({ id }).delete()),
    meta: { successMessage: m.contract_toast_deleted() },
    onSuccess: (_result, id) => {
      qc.removeQueries({ queryKey: queryKeys.contract(id) });
      invalidateContractViews(qc);
    },
  });
}

export function useLeaveContractMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.api.contracts({ id }).me.delete()),
    meta: { successMessage: m.contract_toast_left() },
    onSuccess: () => {
      qc.removeQueries({ queryKey: queryKeys.contract(id) });
      invalidateContractViews(qc);
    },
  });
}

/** The History tab (Task 8), 50 a page with an opaque cursor (Task 2); under the contract's key, so invalidating the contract refreshes it. */
export const contractEventsQueryOptions = (id: string) =>
  infiniteQueryOptions({
    queryKey: [...queryKeys.contract(id), "events"] as const,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.api
          .contracts({ id })
          .events.get({ query: pageParam ? { before: pageParam } : {} })
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextBefore,
  });
