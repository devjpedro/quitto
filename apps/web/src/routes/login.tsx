import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginPage } from "@/features/auth/components/login-page";
import { invitePreviewQueryOptions } from "@/features/invites/api";
import { inviteTokenOf } from "@/features/invites/lib/invite-redirect";

export const Route = createFileRoute("/login")({
  validateSearch: (
    s: Record<string, unknown>
  ): { mode?: "signup"; redirect?: string } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    ...(s.mode === "signup" ? { mode: "signup" as const } : {}),
  }),
  // Signed in: nothing to do here (only the SSR knows the session; the client
  // keeps it in the cache). The reset and verify pages stay open when signed in.
  beforeLoad: ({ context }) => {
    if (context.session === "authed") {
      throw redirect({ to: "/" });
    }
  },
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
