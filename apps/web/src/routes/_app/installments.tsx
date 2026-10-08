import { todayISO } from "@quitto/shared";
import { createFileRoute } from "@tanstack/react-router";
import { contractQueryOptions } from "@/features/contracts/api";
import {
  installmentQueryOptions,
  installmentsListQueryOptions,
} from "@/features/installments/api";
import { InstallmentsPage } from "@/features/installments/components/installments-page";
import { installmentsSearch } from "@/features/installments/lib/installments-search";
import { monthOf, monthQuery } from "@/features/installments/lib/month-range";

export const Route = createFileRoute("/_app/installments")({
  validateSearch: installmentsSearch,
  loaderDeps: ({ search }) => ({
    contract: search.contract,
    installment: search.installment,
    month: search.month,
  }),
  // Not awaited: the SSR streams the list (and, in parallel, the open
  // installment and its contract) into the page's SectionBoundary.
  loader: ({ context, deps }) => {
    const today = todayISO();
    context.queryClient.prefetchQuery(
      installmentsListQueryOptions(
        monthQuery(deps.month ?? monthOf(today), today)
      )
    );
    if (deps.installment && deps.contract) {
      context.queryClient.prefetchQuery(contractQueryOptions(deps.contract));
      context.queryClient.prefetchQuery(
        installmentQueryOptions(deps.installment)
      );
    }
  },
  component: InstallmentsPage,
});
