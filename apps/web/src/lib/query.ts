import {
  type Mutation,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "./api-client";
import { errorMessage } from "./error-message";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { successMessage?: string };
  }
}

/** 401 is handled by the auth guard (redirect); don't toast it. */
function shouldToast(error: unknown): boolean {
  return !(error instanceof ApiError && error.httpStatus === 401);
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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (shouldToast(error)) {
        toast.error(errorMessage(error));
      }
    },
  }),
  mutationCache: new MutationCache({
    onSuccess: toastSuccessFromMeta,
    onError: (error) => {
      if (shouldToast(error)) {
        toast.error(errorMessage(error));
      }
    },
  }),
});
