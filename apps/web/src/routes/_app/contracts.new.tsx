import { createFileRoute } from "@tanstack/react-router";
import { ContractNewPage } from "@/features/contracts/contract-new-page";

export const Route = createFileRoute("/_app/contracts/new")({
  component: ContractNewPage,
});
