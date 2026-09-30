import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { receiptShare } from "../db/schema";

/** 256 bits aleatórios em base64url (43 chars) — inviável de enumerar. */
export function newShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function findActiveShare(
  installmentId: string
): Promise<{ token: string; createdAt: Date } | null> {
  const [row] = await db
    .select({ token: receiptShare.token, createdAt: receiptShare.createdAt })
    .from(receiptShare)
    .where(
      and(
        eq(receiptShare.installmentId, installmentId),
        isNull(receiptShare.revokedAt)
      )
    )
    .limit(1);
  return row ?? null;
}
