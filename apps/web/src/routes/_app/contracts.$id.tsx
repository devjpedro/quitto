import { createFileRoute } from "@tanstack/react-router";
import {
  contractEventsQueryOptions,
  contractQueryOptions,
} from "@/features/contracts/api";
import { ContractPage } from "@/features/contracts/components/contract-page";
import { CONTRACT_SLOTS } from "@/features/contracts/components/contract-slots";
import { installmentQueryOptions } from "@/features/installments/api";
import { contractSearch } from "@/lib/contract-search";
import { waitOnServer } from "@/lib/ssr-section-wait";

/** The page with the slots the later tasks fill (contract-slots.tsx): this file never changes again. */
function ContractRoutePage() {
  return <ContractPage slots={CONTRACT_SLOTS} />;
}

export const Route = createFileRoute("/_app/contracts/$id")({
  validateSearch: contractSearch,
  loaderDeps: ({ search }) => ({
    installment: search.installment,
    tab: search.tab,
  }),
  // The SSR waits a moment for the contract (lib/ssr-section-wait.ts), then
  // streams it, with the open installment or the history tab in parallel,
  // into the page's SectionBoundary.
  loader: async ({ context, deps, params }) => {
    const contract = context.queryClient.prefetchQuery(
      contractQueryOptions(params.id)
    );
    if (deps.installment) {
      context.queryClient.prefetchQuery(
        installmentQueryOptions(deps.installment)
      );
    }
    if (deps.tab === "history") {
      context.queryClient.prefetchInfiniteQuery(
        contractEventsQueryOptions(params.id)
      );
    }
    await waitOnServer(contract);
  },
  component: ContractRoutePage,
});
