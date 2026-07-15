import { createFileRoute } from "@tanstack/react-router";
import { ContractsListPage } from "@/features/contracts/contracts-list-page";

export const Route = createFileRoute("/_app/contracts/")({
  component: ContractsListPage,
});
