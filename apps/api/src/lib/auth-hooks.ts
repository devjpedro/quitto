import { APIError, createAuthMiddleware } from "better-auth/api";
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

export const authBeforeHook = createAuthMiddleware((ctx) => {
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
  return Promise.resolve();
});
