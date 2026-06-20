import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "./db/client";
import { env } from "./env";
import { AUTH_RATE_RULES } from "./lib/auth-rate-limit";
import { resetPasswordEmail } from "./lib/email-templates";
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
    sendResetPassword: async ({
      user,
      url,
    }: {
      user: { email: string };
      url: string;
    }) => {
      const { subject, html } = resetPasswordEmail(url);
      await sendEmail({ to: user.email, subject, html });
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
