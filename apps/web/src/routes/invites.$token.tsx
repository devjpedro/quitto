import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import {
  inviteLookupQueryOptions,
  invitePreviewQueryOptions,
} from "@/features/invites/api";
import { InviteFallback } from "@/features/invites/components/invite-fallback";
import { InvitePage } from "@/features/invites/components/invite-page";
import { useApiWarmup } from "@/hooks/use-api-warmup";
import { PAGE_TITLE } from "@/lib/page-title";
import { waitOnServer } from "@/lib/ssr-section-wait";

/**
 * Outside the app's layouts (owner's decision 1 and 13): it reads the
 * session the root seeded and never redirects; the page decides.
 */
export const Route = createFileRoute("/invites/$token")({
  // The SSR waits a moment for the invite (lib/ssr-section-wait.ts), then
  // streams it into the page's Suspense.
  loader: async ({ context, params }) => {
    const reads = [
      context.queryClient.prefetchQuery(inviteLookupQueryOptions(params.token)),
    ];
    if (context.session === "anon") {
      reads.push(
        context.queryClient.prefetchQuery(
          invitePreviewQueryOptions(params.token)
        )
      );
    }
    await waitOnServer(Promise.all(reads));
  },
  head: () => ({
    meta: [
      { title: PAGE_TITLE.acceptInvite },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InviteRoute,
});

function InviteRoute() {
  useApiWarmup();
  const { token } = Route.useParams();
  return (
    <Suspense fallback={<InviteFallback />}>
      <InvitePage token={token} />
    </Suspense>
  );
}
