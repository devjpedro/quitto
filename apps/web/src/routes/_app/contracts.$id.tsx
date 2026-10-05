import { createFileRoute } from "@tanstack/react-router";
import { ContractDetailPage } from "@/features/contracts/contract-detail-page";
import { contractSearch } from "@/lib/contract-search";

export const Route = createFileRoute("/_app/contracts/$id")({
  validateSearch: contractSearch,
  component: ContractDetailPage,
});
