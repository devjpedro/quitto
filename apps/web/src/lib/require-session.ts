import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { meQueryOptions } from "@/hooks/use-me";
import { ApiError } from "@/lib/api-client";

/** Ensures a session exists (via cached /api/me). Throws a redirect to /login on 401. */
export async function requireSession(
  queryClient: QueryClient,
  currentHref: string
): Promise<void> {
  try {
    await queryClient.ensureQueryData(meQueryOptions);
  } catch (err) {
    if (err instanceof ApiError && err.httpStatus === 401) {
      throw redirect({ to: "/login", search: { redirect: currentHref } });
    }
    throw err;
  }
}
