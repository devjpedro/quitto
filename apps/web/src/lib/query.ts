import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "./api-client";
import { errorMessage } from "./error-message";

/** 401 is handled by the auth guard (redirect); don't toast it. */
function shouldToast(error: unknown): boolean {
  return !(error instanceof ApiError && error.httpStatus === 401);
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
    onError: (error) => {
      if (shouldToast(error)) {
        toast.error(errorMessage(error));
      }
    },
  }),
});
