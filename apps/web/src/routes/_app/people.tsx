import { createFileRoute } from "@tanstack/react-router";
import { peopleQueryOptions } from "@/features/people/api";
import { PeoplePage } from "@/features/people/components/people-page";
import { peopleSearch } from "@/features/people/lib/people-search";

export const Route = createFileRoute("/_app/people")({
  validateSearch: peopleSearch,
  // Not awaited: the SSR streams the grid into the page's SectionBoundary.
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(peopleQueryOptions);
  },
  component: PeoplePage,
});
