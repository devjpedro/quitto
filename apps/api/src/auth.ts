import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { db, schema } from "./db/client";
import { env } from "./env";
import { AUTH_RATE_RULES } from "./lib/auth-rate-limit";
import { resetPasswordEmail, verificationEmail } from "./lib/email-templates";
import { localeFromHeaders, pickLocale, userLocale } from "./lib/locale";
import { sendEmail } from "./lib/mailer";

const googleProvider =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined;

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification:
      env.NODE_ENV === "production" ||
      env.REQUIRE_EMAIL_VERIFICATION === "true",
    sendResetPassword: async (
      { user, url }: { user: { email: string; id: string }; url: string },
      request?: Request
    ) => {
      const locale = pickLocale(
        await userLocale(user.id),
        localeFromHeaders(request?.headers)
      );
      const { subject, html } = resetPasswordEmail(url, locale);
      await sendEmail({ to: user.email, subject, html });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async (
      { user, url }: { user: { email: string; id: string }; url: string },
      request?: Request
    ) => {
      const locale = pickLocale(
        await userLocale(user.id),
        localeFromHeaders(request?.headers)
      );
      const { subject, html } = verificationEmail(url, locale);
      await sendEmail({ to: user.email, subject, html });
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Reminders and invites leave outside a request: keep the language the person signed up in.
        after: async (created, context) => {
          const locale = localeFromHeaders(context?.headers);
          if (!locale) {
            return;
          }
          try {
            await db
              .update(schema.user)
              .set({ locale })
              .where(eq(schema.user.id, created.id));
          } catch (err) {
            console.warn(`[auth] não gravou o idioma do cadastro: ${err}`);
          }
        },
      },
    },
  },
  socialProviders: googleProvider,
  trustedOrigins: [env.WEB_ORIGIN],
  rateLimit: {
    enabled: env.NODE_ENV === "production" || env.RATE_LIMIT_ENABLED === "true",
    storage: "memory",
    customRules: AUTH_RATE_RULES,
  },
});
