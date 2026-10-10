import { createFileRoute } from "@tanstack/react-router";
import { peopleQueryOptions } from "@/features/people/api";
import { PeoplePage } from "@/features/people/components/people-page";
import { peopleSearch } from "@/features/people/lib/people-search";
import { waitOnServer } from "@/lib/ssr-section-wait";

export const Route = createFileRoute("/_app/people")({
  validateSearch: peopleSearch,
  // The SSR waits a moment for the grid (lib/ssr-section-wait.ts), then
  // streams it into the page's SectionBoundary.
  loader: async ({ context }) => {
    await waitOnServer(context.queryClient.prefetchQuery(peopleQueryOptions));
  },
  component: PeoplePage,
});
