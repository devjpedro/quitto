import {
  type Mutation,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "./api-client";
import { errorMessage } from "./error-message";
import { queryKeys } from "./query-keys";
import { isTimeoutError } from "./with-timeout";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** Said instead of the generic toast when the mutation fails (a failure the caller can name). */
      errorMessage?: string;
      /** silentError: the mutation shows its own error (a field, a sheet), so no toast. */
      silentError?: boolean;
      successMessage?: string;
    };
    /** silentRefetchError: a failed background refetch of this query never toasts. */
    queryMeta: { silentRefetchError?: boolean };
  }
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.httpStatus === 401;
}

/** 401 is handled by the auth guard (redirect); don't toast it. */
function shouldToast(error: unknown): boolean {
  return !isUnauthorized(error);
}

/**
 * Retries a failed query once, but never a 401 (the session gate redirects)
 * nor a timeout (the section shows "Try again" and the user decides).
 */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown
): boolean {
  if (isTimeoutError(error) || isUnauthorized(error)) {
    return false;
  }
  return failureCount < 1;
}

/** Dispara toast.success quando a mutation declara meta.successMessage. */
export function toastSuccessFromMeta(
  _data: unknown,
  _variables: unknown,
  _onMutateResult: unknown,
  mutation: Mutation<unknown, unknown, unknown, unknown>
): void {
  const message = mutation.meta?.successMessage;
  if (typeof message === "string" && message.length > 0) {
    toast.success(message);
  }
}

/** Cria um QueryClient novo (fresh por request no SSR). */
export function makeQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
        // Erro de dado (não-401) sobe pra ErrorBoundary → "Ops, algo deu errado"
        // (evita tela branca com dados client-fetched). 401 fica pro gate de sessão.
        throwOnError: (error) =>
          !(error instanceof ApiError && error.httpStatus === 401),
      },
      dehydrate: {
        // A pending SSR query that times out reaches the browser as its error;
        // redacted, it would be retried and shown as a generic failure.
        shouldRedactErrors: (error) => !isTimeoutError(error),
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Sessão caiu no meio do uso: revalida `me` e o gate do AppLayout
        // manda pro /login (no cliente não há check de sessão por navegação).
        if (isUnauthorized(error) && query.queryKey[0] !== queryKeys.me[0]) {
          client.invalidateQueries({ queryKey: queryKeys.me });
        }
        // Initial-load failures are shown inline (SectionBoundary or the route
        // ErrorBoundary), so toasting them too would report the error twice.
        // Only a failed background refetch, with data still on screen, toasts,
        // unless the query opted out (the home refetches on every focus).
        if (
          query.state.data !== undefined &&
          !query.meta?.silentRefetchError &&
          shouldToast(error)
        ) {
          toast.error(errorMessage(error));
        }
      },
    }),
    mutationCache: new MutationCache({
      onSuccess: toastSuccessFromMeta,
      onError: (error, _variables, _onMutateResult, mutation) => {
        if (mutation.meta?.silentError) {
          return;
        }
        if (shouldToast(error)) {
          toast.error(mutation.meta?.errorMessage ?? errorMessage(error));
        }
      },
    }),
  });
  return client;
}

// Singleton transitório (consumidores client-side migram pro contexto no Task 6).
export const queryClient = makeQueryClient();
