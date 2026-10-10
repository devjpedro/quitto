import { createFileRoute } from "@tanstack/react-router";
import { ContractsPage } from "@/features/contracts/components/contracts-page";
import { contractsListSearch } from "@/features/contracts/lib/contracts-list-search";
import { contractsQueryOptions } from "@/hooks/use-contracts";

export const Route = createFileRoute("/_app/contracts/")({
  validateSearch: contractsListSearch,
  // Not awaited: the SSR streams the list into the page's SectionBoundary.
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(contractsQueryOptions);
  },
  component: ContractsPage,
});
