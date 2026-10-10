export interface PersonRow {
  createdAt: Date;
  displayName: string;
  id: string;
  linkedUserId: string | null;
  role: string;
}

export interface InviteRow {
  acceptedAt: Date | null;
  createdAt: Date;
  declinedAt: Date | null;
  email: string;
  expiresAt: Date;
  participantId: string;
  token: string;
}

export interface PersonView {
  displayName: string;
  email: string | null;
  id: string;
  invite: {
    sentAt: string;
    status: "pending" | "expired" | "declined";
    url: string | null;
  } | null;
  isMe: boolean;
  isOwner: boolean;
  joinedAt: string | null;
  linked: boolean;
  role: string;
}

function rank(person: PersonRow, ownerId: string): number {
  if (person.linkedUserId === ownerId) {
    return 0;
  }
  return person.role === "viewer" ? 2 : 1;
}

function latestInvite(
  invites: InviteRow[],
  participantId: string
): InviteRow | undefined {
  return invites
    .filter((i) => i.participantId === participantId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

function inviteOf(
  person: PersonRow,
  latest: InviteRow | undefined,
  ctx: { now: Date; viewerIsOwner: boolean; webOrigin: string }
): PersonView["invite"] {
  if (person.linkedUserId || !latest || latest.acceptedAt !== null) {
    return null;
  }
  let status: "pending" | "expired" | "declined" = "pending";
  if (latest.declinedAt) {
    status = "declined";
  } else if (latest.expiresAt.getTime() <= ctx.now.getTime()) {
    status = "expired";
  }
  return {
    status,
    sentAt: latest.createdAt.toISOString(),
    url:
      ctx.viewerIsOwner && status !== "declined"
        ? `${ctx.webOrigin}/invites/${latest.token}`
        : null,
  };
}

function joinedAtOf(
  person: PersonRow,
  isOwner: boolean,
  contractCreatedAt: Date,
  accepted: InviteRow | undefined
): string | null {
  if (isOwner) {
    return contractCreatedAt.toISOString();
  }
  if (person.linkedUserId) {
    return (accepted?.acceptedAt ?? person.createdAt).toISOString();
  }
  return null;
}

/**
 * The People tab (planner's decision 8): each person with what this viewer
 * may see. Only the owner sees the others' e-mails and the invite link; each
 * person sees their own e-mail. An invite shows on a person without an
 * account: pending, expired or declined.
 */
export function peopleView(args: {
  contractCreatedAt: Date;
  /** userId → the account's e-mail. */
  emails: ReadonlyMap<string, string>;
  invites: InviteRow[];
  now: Date;
  ownerId: string;
  people: PersonRow[];
  viewerId: string;
  webOrigin: string;
}): PersonView[] {
  const { emails, invites, now, ownerId, viewerId, webOrigin } = args;
  const viewerIsOwner = viewerId === ownerId;
  return [...args.people]
    .sort(
      (a, b) =>
        rank(a, ownerId) - rank(b, ownerId) ||
        a.createdAt.getTime() - b.createdAt.getTime()
    )
    .map((person) => {
      const isOwner = person.linkedUserId === ownerId;
      const isMe = person.linkedUserId === viewerId;
      const latest = latestInvite(invites, person.id);
      const accepted = invites.find(
        (i) => i.participantId === person.id && i.acceptedAt !== null
      );
      const rawEmail = person.linkedUserId
        ? (emails.get(person.linkedUserId) ?? null)
        : (latest?.email ?? null);
      const invite = inviteOf(person, latest, {
        now,
        viewerIsOwner,
        webOrigin,
      });
      const joinedAt = joinedAtOf(
        person,
        isOwner,
        args.contractCreatedAt,
        accepted
      );
      return {
        id: person.id,
        displayName: person.displayName,
        role: person.role,
        linked: person.linkedUserId !== null,
        isOwner,
        isMe,
        email: viewerIsOwner || isMe ? rawEmail : null,
        invite,
        joinedAt,
      };
    });
}
