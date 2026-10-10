import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/features/settings/components/settings-page";
import { meQueryOptions } from "@/hooks/use-me";

export const Route = createFileRoute("/_app/settings/")({
  // Prefetched with the page; the sections read it under their own boundary.
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(meQueryOptions);
  },
  component: () => <SettingsPage section={null} />,
});
