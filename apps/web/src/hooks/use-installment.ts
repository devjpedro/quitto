import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** GET /api/installments/:id — proofs (signed download URLs) + audit timeline. */
export const installmentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.installment(id),
    queryFn: () => unwrap(api.api.installments({ installmentId: id }).get()),
  });

/** `enabled` lets the drawer fetch only while it is open. */
export function useInstallmentQuery(id: string, enabled: boolean) {
  return useQuery({ ...installmentQueryOptions(id), enabled });
}
