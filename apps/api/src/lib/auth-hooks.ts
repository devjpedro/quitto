import { createHash } from "node:crypto";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "../db/client";
import { normalizeEmail } from "./email";
import { createRateLimiter, rateLimitOn } from "./rate-limit";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Per-email caps on top of the per-IP ones: a botnet varies the IP, not the target. A full table fails open (the per-IP limit still holds). */
const emailLimiters: Record<string, ReturnType<typeof createRateLimiter>> = {
  "/sign-in/email": createRateLimiter({
    max: 5,
    windowMs: 15 * MINUTE,
    onFull: "allow",
  }),
  "/request-password-reset": createRateLimiter({
    max: 3,
    windowMs: HOUR,
    onFull: "allow",
  }),
  "/send-verification-email": createRateLimiter({
    max: 3,
    windowMs: HOUR,
    onFull: "allow",
  }),
};

export const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;

/** Limiter key for an email: a fixed-size hash, so a huge value never sits in memory. */
function emailKey(rawEmail: string): string {
  return createHash("sha256").update(normalizeEmail(rawEmail)).digest("hex");
}

/**
 * Drops an unverified, password-only account before a new sign-up on the same
 * email: whoever registered first without proving the address must not keep
 * the password they chose (pre-hijacking). Verified or social accounts stay.
 */
async function dropUnverifiedSquatter(email: string): Promise<void> {
  const [existing] = await db
    .select({ id: schema.user.id, emailVerified: schema.user.emailVerified })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  if (!existing || existing.emailVerified) {
    return;
  }
  const [social] = await db
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(
      and(
        eq(schema.account.userId, existing.id),
        ne(schema.account.providerId, "credential")
      )
    )
    .limit(1);
  if (social) {
    return;
  }
  await db.delete(schema.user).where(eq(schema.user.id, existing.id));
}

/** The claims of a JWT, read without verifying it (Better Auth verifies it right after). */
function unverifiedClaims(token: string): { email?: unknown; iat?: unknown } {
  try {
    const payload = token.split(".")[1] ?? "";
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

/**
 * A verification link only counts for the account that asked for it: if the
 * address was re-registered after the link was issued (the squatter's account
 * was dropped), the old link must not verify the new account.
 */
async function assertLinkFromCurrentAccount(token: unknown): Promise<void> {
  if (typeof token !== "string") {
    return;
  }
  const { email, iat } = unverifiedClaims(token);
  if (typeof email !== "string" || typeof iat !== "number") {
    return;
  }
  const [existing] = await db
    .select({ createdAt: schema.user.createdAt })
    .from(schema.user)
    .where(eq(schema.user.email, normalizeEmail(email)))
    .limit(1);
  // iat has second resolution, createdAt millisecond: compare in seconds.
  if (existing && iat < Math.floor(existing.createdAt.getTime() / 1000)) {
    throw new APIError("BAD_REQUEST", {
      message: "Link inválido. Peça um novo e-mail de verificação.",
    });
  }
}

function checkName(body: unknown): void {
  const name = (body as { name?: unknown } | null)?.name;
  if (typeof name === "string" && name.length > MAX_NAME_LENGTH) {
    throw new APIError("BAD_REQUEST", { message: "Nome muito longo." });
  }
}

export const authBeforeHook = createAuthMiddleware(async (ctx) => {
  const body = ctx.body as { email?: unknown } | null;
  const rawEmail = typeof body?.email === "string" ? body.email : null;

  if (rawEmail && rawEmail.length > MAX_EMAIL_LENGTH) {
    throw new APIError("BAD_REQUEST", { message: "E-mail inválido." });
  }

  const limiter = emailLimiters[ctx.path];
  if (
    limiter &&
    rateLimitOn() &&
    rawEmail &&
    !limiter.hit(`${ctx.path}:${emailKey(rawEmail)}`)
  ) {
    throw new APIError("TOO_MANY_REQUESTS", {
      message: "Muitas tentativas. Tente mais tarde.",
    });
  }

  if (ctx.path === "/sign-up/email") {
    checkName(ctx.body);
    if (rawEmail) {
      await dropUnverifiedSquatter(normalizeEmail(rawEmail));
    }
  }
  if (ctx.path === "/verify-email") {
    await assertLinkFromCurrentAccount(ctx.query?.token);
  }
  if (ctx.path === "/update-user") {
    checkName(ctx.body);
  }
});
