import { useSuspenseQuery } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { inviteLookupQueryOptions } from "../api";
import { inviteScreen } from "../lib/invite-screen";
import { InviteFrame } from "./invite-frame";
import { InviteMissing } from "./invite-missing";

/** /invites/$token: one read picks the screen. */
export function InvitePage({ token }: { token: string }) {
  const { data } = useSuspenseQuery(inviteLookupQueryOptions(token));
  const screen = inviteScreen(data);
  if (screen.kind === "missing") {
    return <InviteMissing />;
  }
  if (screen.kind === "guest") {
    // Task 10 shows the invite before signing in; until then, the old wall.
    return <Navigate search={{ redirect: `/invites/${token}` }} to="/login" />;
  }
  return <InviteFrame screen={screen} token={token} />;
}
