import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** GET /api/installments/:id (Task 1): what the panel draws. */
export const installmentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.installment(id),
    queryFn: () => unwrap(api.api.installments({ installmentId: id }).get()),
  });
