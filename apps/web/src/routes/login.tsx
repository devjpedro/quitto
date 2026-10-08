import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/features/auth/login-page";
import { invitePreviewQueryOptions } from "@/features/invites/api";
import { inviteTokenOf } from "@/features/invites/lib/invite-redirect";

export const Route = createFileRoute("/login")({
  validateSearch: (
    s: Record<string, unknown>
  ): { mode?: "signup"; redirect?: string } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    ...(s.mode === "signup" ? { mode: "signup" as const } : {}),
  }),
  loaderDeps: ({ search }) => ({ redirect: search.redirect }),
  // Prefetched with the page; shown after hydration, like the shell's selectors. The form never waits for it.
  loader: ({ context, deps }) => {
    const token = inviteTokenOf(deps.redirect);
    if (token) {
      context.queryClient.prefetchQuery(invitePreviewQueryOptions(token));
    }
  },
  component: LoginPage,
});
