import { createFileRoute, redirect } from "@tanstack/react-router";

// The history moved to the bell panel and the actions to "Agora": old
// bookmarks land on the home. Remove in Fase 6.
export const Route = createFileRoute("/_app/notifications")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
