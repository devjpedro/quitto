/** Window (seconds) and max requests per IP for sensitive auth endpoints. */
export const AUTH_RATE_LIMITS = {
  window: 60,
  signIn: 8,
  signUp: 5,
  requestPasswordReset: 4,
  resetPassword: 6,
  sendVerificationEmail: 4,
} as const;

export const AUTH_RATE_RULES = {
  "/sign-in/email": {
    window: AUTH_RATE_LIMITS.window,
    max: AUTH_RATE_LIMITS.signIn,
  },
  "/sign-up/email": {
    window: AUTH_RATE_LIMITS.window,
    max: AUTH_RATE_LIMITS.signUp,
  },
  "/request-password-reset": {
    window: AUTH_RATE_LIMITS.window,
    max: AUTH_RATE_LIMITS.requestPasswordReset,
  },
  "/reset-password": {
    window: AUTH_RATE_LIMITS.window,
    max: AUTH_RATE_LIMITS.resetPassword,
  },
  "/send-verification-email": {
    window: AUTH_RATE_LIMITS.window,
    max: AUTH_RATE_LIMITS.sendVerificationEmail,
  },
} as const;
