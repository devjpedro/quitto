import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { inviteLookupQueryOptions } from "@/features/invites/api";
import { InviteFallback } from "@/features/invites/components/invite-fallback";
import { InvitePage } from "@/features/invites/components/invite-page";
import { useApiWarmup } from "@/hooks/use-api-warmup";
import { PAGE_TITLE } from "@/lib/page-title";
import { seedSession } from "@/lib/session-route";

/**
 * Outside the app's layouts (owner's decision 1 and 13): it seeds the
 * session when there is one and never redirects; the page decides.
 */
export const Route = createFileRoute("/invites/$token")({
  beforeLoad: async ({ context }) => ({
    session: await seedSession(context.queryClient),
  }),
  loader: ({ context, params }) => {
    context.queryClient.prefetchQuery(inviteLookupQueryOptions(params.token));
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
