import { createFileRoute } from "@tanstack/react-router";
import { ContractNewPage } from "@/features/contracts/contract-new-page";

/** Espelha o `maxLength` do título no `CreateContractBody` da API. */
const TITLE_MAX = 200;

export const Route = createFileRoute("/_app/contracts/new")({
  validateSearch: (s: Record<string, unknown>): { title?: string } => {
    const raw = typeof s.title === "string" ? s.title.trim() : "";
    return raw ? { title: raw.slice(0, TITLE_MAX) } : {};
  },
  component: ContractNewPage,
});
