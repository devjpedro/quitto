import { DIRECTION, type Direction } from "@quitto/shared";
import {
  type Capabilities,
  capabilitiesFromRows,
  pickRecebedor,
  type Recebedor,
} from "./contract-access";
import { installmentPix } from "./installment-pix";

export interface HomeContractRow {
  createdAt: Date;
  id: string;
  installmentsCount: number;
  ownerId: string;
  ownerRole: string;
  requiresConfirmation: boolean;
  status: string;
  title: string;
}

export interface HomeInstallmentRow {
  amountCents: number;
  contractId: string;
  dueDate: string;
  id: string;
  /** Latest proof upload: when the payer acted in a contract with confirmation. */
  lastProofAt: Date | null;
  /** Mark/upload time without confirmation; confirmation time with it. */
  paidAt: Date | null;
  sequence: number;
  status: string;
}

export interface HomeParticipantRow {
  contractId: string;
  displayName: string;
  linkedUserId: string | null;
  /** The receiver's key kept on a contact without an account. */
  pixKey: string | null;
  role: string;
}

export interface HomeUserRow {
  id: string;
  name: string;
  pixKey: string | null;
}

/** Everything the home reads about the caller's contracts, loaded in batch. */
export interface HomeContractRows {
  contracts: HomeContractRow[];
  installments: HomeInstallmentRow[];
  participants: HomeParticipantRow[];
  users: HomeUserRow[];
}

/** The caller's side of a contract they pay or receive in (viewers are left out). */
export interface PartyContract {
  caps: Capabilities;
  contract: HomeContractRow;
  counterpartyName: string | null;
  direction: Direction;
  installments: HomeInstallmentRow[];
  recebedor: Recebedor;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const list = out.get(key(item));
    if (list) {
      list.push(item);
    } else {
      out.set(key(item), [item]);
    }
  }
  return out;
}

/** The single buyer's name, or null when there is none (or more than one). */
function payerName(people: HomeParticipantRow[]): string | null {
  const buyers = people.filter((p) => p.role === "buyer");
  return buyers.length === 1 ? (buyers[0]?.displayName ?? null) : null;
}

export function partyContracts(
  userId: string,
  rows: HomeContractRows
): PartyContract[] {
  const peopleBy = groupBy(rows.participants, (p) => p.contractId);
  const installmentsBy = groupBy(rows.installments, (i) => i.contractId);
  const users = new Map(rows.users.map((u) => [u.id, u]));
  const parties: PartyContract[] = [];
  for (const c of rows.contracts) {
    if (c.status === "cancelled") {
      continue;
    }
    const people = peopleBy.get(c.id) ?? [];
    const caps = capabilitiesFromRows(userId, c, people);
    if (!caps || caps.role === "viewer") {
      continue;
    }
    const direction = caps.role === "buyer" ? DIRECTION.pay : DIRECTION.receive;
    const recebedor = pickRecebedor(c, people, users);
    parties.push({
      caps,
      contract: c,
      direction,
      recebedor,
      counterpartyName:
        direction === DIRECTION.pay ? recebedor.displayName : payerName(people),
      installments: installmentsBy.get(c.id) ?? [],
    });
  }
  return parties;
}

/** BR Code for this amount when the receiver has a usable key; a stale key never breaks the home. */
export function pixCodeFor(
  party: PartyContract,
  amountCents: number
): string | null {
  return installmentPix(party.recebedor, amountCents)?.code ?? null;
}
