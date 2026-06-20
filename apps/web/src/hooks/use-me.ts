import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ApiError, unwrap } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { withTimeout } from "@/lib/with-timeout";

const SESSION_STALE_MS = 5 * 60_000;
const SESSION_TIMEOUT_MS = 8000;
export const SESSION_RETRY_MAX = 4;
const SESSION_RETRY_BASE_MS = 600;

// Cold start: numa máquina fria do Fly o /api/me pode dar timeout ou 5xx
// enquanto a API boota. Re-tentamos esses casos transitórios (some o F5), mas
// um 401 é "sessão ausente de verdade" → não re-tenta, redireciona rápido.
export function shouldRetrySession(
  failureCount: number,
  error: unknown
): boolean {
  if (error instanceof ApiError && error.httpStatus === 401) {
    return false;
  }
  return failureCount < SESSION_RETRY_MAX;
}

export const meQueryOptions = queryOptions({
  queryKey: queryKeys.me,
  queryFn: () => withTimeout(unwrap(api.api.me.get()), SESSION_TIMEOUT_MS),
  staleTime: SESSION_STALE_MS,
  retry: shouldRetrySession,
  retryDelay: (attempt) => SESSION_RETRY_BASE_MS * 2 ** attempt,
});

export function useMeQuery() {
  return useQuery(meQueryOptions);
}
