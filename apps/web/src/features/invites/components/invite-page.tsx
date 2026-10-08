import { useSuspenseQuery } from "@tanstack/react-query";
import { inviteLookupQueryOptions } from "../api";
import { inviteScreen } from "../lib/invite-screen";
import { InviteFrame } from "./invite-frame";
import { InviteGuest } from "./invite-guest";
import { InviteMissing } from "./invite-missing";

/** /invites/$token: one read picks the screen. */
export function InvitePage({ token }: { token: string }) {
  const { data } = useSuspenseQuery(inviteLookupQueryOptions(token));
  const screen = inviteScreen(data);
  if (screen.kind === "missing") {
    return <InviteMissing />;
  }
  if (screen.kind === "guest") {
    return <InviteGuest token={token} />;
  }
  return <InviteFrame screen={screen} token={token} />;
}
