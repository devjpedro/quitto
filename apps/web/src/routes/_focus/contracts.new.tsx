import { createFileRoute } from "@tanstack/react-router";
import { ContractWizardPage } from "@/features/contract-wizard/components/wizard-page";
import { peopleQueryOptions } from "@/features/people/api";

/** Mirrors the title's 200 characters in the shared schema. */
const TITLE_MAX = 200;

export const Route = createFileRoute("/_focus/contracts/new")({
  validateSearch: (s: Record<string, unknown>): { title?: string } => {
    const raw = typeof s.title === "string" ? s.title.trim() : "";
    return raw ? { title: raw.slice(0, TITLE_MAX) } : {};
  },
  // Not awaited: the suggestions at step 3 are there if the list is, never a wait.
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(peopleQueryOptions);
  },
  component: ContractWizardPage,
});
