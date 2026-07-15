import { createFileRoute } from "@tanstack/react-router";
import { ContractDetailPage } from "@/features/contracts/contract-detail-page";

export const Route = createFileRoute("/_app/contracts/$id")({
  validateSearch: (s: Record<string, unknown>) => ({
    installment: typeof s.installment === "string" ? s.installment : undefined,
  }),
  component: ContractDetailPage,
});
