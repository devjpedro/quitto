import type { InviteLookup, InviteView } from "../api";

export interface ViewScreen {
  kind:
    | "decide"
    | "accepted"
    | "declined"
    | "expired"
    | "owner"
    | "otherAccount"
    | "participant";
  view: InviteView;
}

export type InviteScreen = ViewScreen | { kind: "guest" } | { kind: "missing" };

const INVITEE: Record<
  InviteView["status"],
  "decide" | "accepted" | "declined" | "expired"
> = {
  pending: "decide",
  accepted: "accepted",
  declined: "declined",
  expired: "expired",
};

/** Which screen (mockup 15, G and H): the viewer first, then, for the invitee, the status. */
export function viewScreen(view: InviteView): ViewScreen {
  if (view.viewer === "owner") {
    return { kind: "owner", view };
  }
  if (view.viewer === "otherAccount") {
    return { kind: "otherAccount", view };
  }
  if (view.viewer === "alreadyParticipant") {
    return { kind: "participant", view };
  }
  return { kind: INVITEE[view.status], view };
}

export function inviteScreen(lookup: InviteLookup): InviteScreen {
  return lookup.kind === "view" ? viewScreen(lookup.view) : lookup;
}
