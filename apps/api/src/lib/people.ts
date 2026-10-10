import { createHash } from "node:crypto";
import {
  DIRECTION,
  type Direction,
  isOverdue,
  isPaidStatus,
  normalizeName,
} from "@quitto/shared";
import type {
  ContractRows,
  ListParticipantRow,
  SlotInviteRow,
} from "./contract-rows";
import { normalizeEmail } from "./email";
import { type PartyContract, partyContracts } from "./home-parties";

export interface PersonContract {
  contractId: string;
  direction: Direction;
  installmentsCount: number;
  nextDueDate: string | null;
  overdueCount: number;
  paidCount: number;
  remainingCents: number;
  reviewCount: number;
  settled: boolean;
  title: string;
}

export interface PersonSummary {
  account: "linked" | "invited" | "none";
  contracts: PersonContract[];
  /** Only when the caller owns at least one contract with the person. */
  email: string | null;
  key: string;
  lastContractAt: string;
  name: string;
  overdueCount: number;
  owesYouCents: number;
  reviewCount: number;
  youOweCents: number;
}

/** What the caller knows of the other side of one contract. */
interface Counterpart {
  /** The linked account, when there is one. */
  accountId: string | null;
  displayName: string;
  /** E-mail of the account or of the slot's latest invite. */
  email: string | null;
  /** E-mail of the latest invite of an unlinked slot, any state. */
  inviteEmail: string | null;
  invitePending: boolean;
  party: PartyContract;
}

/** Opaque and stable per caller: no account id and no e-mail in it. */
export function personKey(viewerId: string, groupKey: string): string {
  return createHash("sha256")
    .update(`${viewerId}|${groupKey}`)
    .digest("hex")
    .slice(0, 16);
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

function latestInviteOf(
  invites: SlotInviteRow[],
  slotId: string
): SlotInviteRow | undefined {
  return invites
    .filter((i) => i.participantId === slotId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

/** The slot opposite to the caller's side: buyer/seller are unique per contract. */
function oppositeSlot(
  party: PartyContract,
  slots: ListParticipantRow[]
): ListParticipantRow | undefined {
  const role = party.direction === DIRECTION.pay ? "seller" : "buyer";
  return slots.find((p) => p.role === role);
}

function counterpartOf(
  viewerId: string,
  party: PartyContract,
  rows: ContractRows,
  slotsBy: Map<string, ListParticipantRow[]>,
  accountsById: Map<string, { email: string; name: string }>,
  now: Date
): Counterpart | null {
  const slot = oppositeSlot(party, slotsBy.get(party.contract.id) ?? []);
  if (slot) {
    if (slot.linkedUserId === viewerId) {
      return null;
    }
    const account = slot.linkedUserId
      ? accountsById.get(slot.linkedUserId)
      : undefined;
    const latest = slot.linkedUserId
      ? undefined
      : latestInviteOf(rows.invites, slot.id);
    return {
      party,
      accountId: slot.linkedUserId,
      displayName: slot.displayName,
      email: account?.email ?? latest?.email ?? null,
      inviteEmail: latest?.email ?? null,
      invitePending:
        !!latest &&
        latest.acceptedAt === null &&
        latest.declinedAt === null &&
        latest.expiresAt.getTime() > now.getTime(),
    };
  }
  // Legacy: the owner holds the opposite side without a slot of their own.
  const { contract } = party;
  const ownerIsOpposite =
    contract.ownerId !== viewerId &&
    contract.ownerRole ===
      (party.direction === DIRECTION.pay ? "seller" : "buyer");
  const owner = ownerIsOpposite
    ? accountsById.get(contract.ownerId)
    : undefined;
  if (!owner) {
    return null;
  }
  return {
    party,
    accountId: contract.ownerId,
    displayName: owner.name,
    email: owner.email,
    inviteEmail: null,
    invitePending: false,
  };
}

function groupKeyOf(
  c: Counterpart,
  linkedByEmail: Map<string, string>
): string | null {
  if (c.accountId) {
    return `u:${c.accountId}`;
  }
  if (c.inviteEmail) {
    const email = normalizeEmail(c.inviteEmail);
    const linked = linkedByEmail.get(email);
    return linked ? `u:${linked}` : `e:${email}`;
  }
  const name = normalizeName(c.displayName);
  return name ? `n:${name}` : null;
}

function personContract(c: Counterpart, today: string): PersonContract {
  const { party } = c;
  let paidCount = 0;
  let remainingCents = 0;
  let overdueCount = 0;
  let reviewCount = 0;
  let nextDueDate: string | null = null;
  for (const it of party.installments) {
    if (isPaidStatus(it.status)) {
      paidCount += 1;
      continue;
    }
    remainingCents += it.amountCents;
    if (nextDueDate === null || it.dueDate < nextDueDate) {
      nextDueDate = it.dueDate;
    }
    if (isOverdue(it.dueDate, it.status, today)) {
      overdueCount += 1;
    }
    if (
      it.status === "awaiting_confirmation" &&
      party.direction === DIRECTION.receive
    ) {
      reviewCount += 1;
    }
  }
  const count = party.installments.length;
  return {
    contractId: party.contract.id,
    title: party.contract.title,
    direction: party.direction,
    installmentsCount: party.contract.installmentsCount,
    paidCount,
    remainingCents,
    overdueCount,
    reviewCount,
    nextDueDate,
    settled: count > 0 && paidCount === count,
  };
}

function rankOf(p: PersonSummary): number {
  if (p.overdueCount > 0) {
    return 0;
  }
  if (p.reviewCount > 0) {
    return 1;
  }
  return p.owesYouCents + p.youOweCents > 0 ? 2 : 3;
}

function summarize(
  viewer: { id: string },
  groupKey: string,
  members: { c: Counterpart; pc: PersonContract }[]
): PersonSummary {
  const newestFirst = [...members].sort(
    (a, b) =>
      b.c.party.contract.createdAt.getTime() -
      a.c.party.contract.createdAt.getTime()
  );
  const [newest] = newestFirst;
  let owes = 0;
  let owe = 0;
  let overdue = 0;
  let review = 0;
  for (const { c, pc } of members) {
    if (c.party.direction === DIRECTION.receive) {
      owes += pc.remainingCents;
    } else {
      owe += pc.remainingCents;
    }
    overdue += pc.overdueCount;
    review += pc.reviewCount;
  }
  let account: PersonSummary["account"] = "none";
  if (members.some(({ c }) => c.accountId)) {
    account = "linked";
  } else if (members.some(({ c }) => c.invitePending)) {
    account = "invited";
  }
  // D5: the e-mail goes only to someone who owns a contract with the person.
  const owned = newestFirst.find(
    ({ c }) => c.party.contract.ownerId === viewer.id && c.email
  );
  return {
    key: personKey(viewer.id, groupKey),
    name: newest?.c.displayName ?? "",
    account,
    email: owned?.c.email ?? null,
    owesYouCents: owes,
    youOweCents: owe,
    overdueCount: overdue,
    reviewCount: review,
    lastContractAt: newest?.c.party.contract.createdAt.toISOString() ?? "",
    contracts: newestFirst.map(({ pc }) => pc),
  };
}

/**
 * The other side of every contract the caller pays or receives in, one entry
 * per person (planner's decisions D3, D4, D5, D7). Pure: rows in, people out.
 */
export function groupPeople(
  viewer: { email: string; id: string },
  rows: ContractRows,
  today: string,
  now: Date
): PersonSummary[] {
  const slotsBy = new Map<string, ListParticipantRow[]>();
  for (const slot of rows.participants) {
    slotsBy.set(slot.contractId, [
      ...(slotsBy.get(slot.contractId) ?? []),
      slot,
    ]);
  }
  const accountsById = new Map(rows.accounts.map((a) => [a.id, a]));
  const counterparts: Counterpart[] = [];
  for (const party of partyContracts(viewer.id, rows)) {
    const c = counterpartOf(viewer.id, party, rows, slotsBy, accountsById, now);
    if (c) {
      counterparts.push(c);
    }
  }
  // An invite to the e-mail of an account that is already a linked
  // counterparty elsewhere is that same person (D4).
  const linkedByEmail = new Map<string, string>();
  for (const { accountId } of counterparts) {
    const account = accountId ? accountsById.get(accountId) : undefined;
    if (accountId && account) {
      linkedByEmail.set(normalizeEmail(account.email), accountId);
    }
  }
  const viewerEmail = normalizeEmail(viewer.email);
  const groups = new Map<string, { c: Counterpart; pc: PersonContract }[]>();
  for (const c of counterparts) {
    const key = groupKeyOf(c, linkedByEmail);
    const email = c.email ?? c.inviteEmail;
    if (!key || (email && normalizeEmail(email) === viewerEmail)) {
      continue;
    }
    const list = groups.get(key) ?? [];
    list.push({ c, pc: personContract(c, today) });
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([key, members]) => summarize(viewer, key, members))
    .sort((a, b) => rankOf(a) - rankOf(b) || collator.compare(a.name, b.name));
}
