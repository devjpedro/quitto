const INVITE_PATH = /^[/]invites[/]([^/?#]+)$/;

/** "/invites/<token>": where the invite lives, and where the login sends back to. */
export function invitePath(token: string): string {
  return `/invites/${token}`;
}

/** The token when the login came from an invite (the `redirect` search), else null. */
export function inviteTokenOf(redirect?: string): string | null {
  return redirect?.match(INVITE_PATH)?.[1] ?? null;
}
