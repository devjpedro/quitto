import { createFileRoute } from "@tanstack/react-router";
import { AcceptInvitePage } from "@/features/invites/accept-invite-page";

export const Route = createFileRoute("/_app/invites/$token")({
  component: AcceptInvitePage,
});
