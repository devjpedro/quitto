import { normalizeName } from "@quitto/shared";
import { and, count, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { db } from "../db/client";
import { contract, installment, participant } from "../db/schema";

export interface DeletionSummary {
  contracts: number;
  installments: number;
  /** The other people on the contracts the account created, one per name, in alphabetical order. */
  people: { name: string }[];
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

/** What deleting the account takes with it: only the contracts this user created (the cascade), never someone else's. */
export async function loadDeletionSummary(
  userId: string
): Promise<DeletionSummary> {
  const owned = await db
    .select({ id: contract.id })
    .from(contract)
    .where(eq(contract.ownerId, userId));
  if (owned.length === 0) {
    return { contracts: 0, installments: 0, people: [] };
  }
  const ids = owned.map((c) => c.id);
  const [installments] = await db
    .select({ n: count() })
    .from(installment)
    .where(inArray(installment.contractId, ids));
  const others = await db
    .select({ name: participant.displayName })
    .from(participant)
    .where(
      and(
        inArray(participant.contractId, ids),
        or(
          isNull(participant.linkedUserId),
          ne(participant.linkedUserId, userId)
        )
      )
    );
  const byKey = new Map<string, string>();
  // Spellings of one name ("Rafael Prado", "rafael  prado") show as one: the
  // tidy one (single spaces), then the lowest in code order, whatever order
  // the rows come in.
  for (const { name: raw } of others) {
    const name = raw.trim().replace(/\s+/g, " ");
    const key = normalizeName(raw);
    const kept = byKey.get(key);
    if (kept === undefined || name < kept) {
      byKey.set(key, name);
    }
  }
  return {
    contracts: owned.length,
    installments: installments?.n ?? 0,
    people: [...byKey.values()]
      .sort((a, b) => collator.compare(a, b))
      .map((name) => ({ name })),
  };
}
