import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/features/dashboard/dashboard-page";

// Dados buscados no cliente (useDashboardQuery); sem loader SSR pra não bloquear no cold start.
export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});
