import { createFileRoute, redirect } from "@tanstack/react-router";
import { SettingsPage } from "@/features/settings/components/settings-page";
import {
  isSettingsSection,
  type SettingsSection,
} from "@/features/settings/lib/settings-sections";
import { meQueryOptions } from "@/hooks/use-me";

export const Route = createFileRoute("/_app/settings/$section")({
  // A name that is not a section is the list again.
  beforeLoad: ({ params }) => {
    if (!isSettingsSection(params.section)) {
      throw redirect({ to: "/settings" });
    }
  },
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(meQueryOptions);
  },
  component: SettingsSectionRoute,
});

function SettingsSectionRoute() {
  const { section } = Route.useParams();
  return <SettingsPage section={section as SettingsSection} />;
}
