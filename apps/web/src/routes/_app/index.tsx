import { createFileRoute } from "@tanstack/react-router";
import { homeQueryOptions } from "@/features/home/api";
import { HomePage } from "@/features/home/components/home-page";

export const Route = createFileRoute("/_app/")({
  // Not awaited: the SSR streams the home into the page's SectionBoundary
  // while the shell and the greeting render at once, cold API included.
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(homeQueryOptions);
  },
  component: HomePage,
});
