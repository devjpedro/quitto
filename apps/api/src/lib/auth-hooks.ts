import { APIError, createAuthMiddleware } from "better-auth/api";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "../db/client";
import { normalizeEmail } from "./email";
import { createRateLimiter, rateLimitOn } from "./rate-limit";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Per-email caps on top of the per-IP ones: a botnet varies the IP, not the target. */
const emailLimiters: Record<string, ReturnType<typeof createRateLimiter>> = {
  "/sign-in/email": createRateLimiter({ max: 5, windowMs: 15 * MINUTE }),
  "/request-password-reset": createRateLimiter({ max: 3, windowMs: HOUR }),
  "/send-verification-email": createRateLimiter({ max: 3, windowMs: HOUR }),
};

export const MAX_NAME_LENGTH = 120;

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

function checkName(body: unknown): void {
  const name = (body as { name?: unknown } | null)?.name;
  if (typeof name === "string" && name.length > MAX_NAME_LENGTH) {
    throw new APIError("BAD_REQUEST", { message: "Nome muito longo." });
  }
}

export const authBeforeHook = createAuthMiddleware(async (ctx) => {
  const body = ctx.body as { email?: unknown } | null;
  const rawEmail = typeof body?.email === "string" ? body.email : null;

  const limiter = emailLimiters[ctx.path];
  if (
    limiter &&
    rateLimitOn() &&
    rawEmail &&
    !limiter.hit(`${ctx.path}:${normalizeEmail(rawEmail)}`)
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
  if (ctx.path === "/update-user") {
    checkName(ctx.body);
  }
});
