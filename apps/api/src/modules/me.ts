import { isLocale, type Locale, parsePixKey } from "@quitto/shared";
import { and, eq, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { user as userTable } from "../db/schema";
import { emailRemindersEnabled } from "../lib/email-reminders";
import { NotFoundError, ValidationError } from "../lib/errors";
import { requireAuth } from "../lib/session";

// The union mirrors LOCALES from @quitto/shared.
const localeSchema = t.Union([t.Literal("pt-BR"), t.Literal("en-US")]);
// null = the user never chose a language. Only reads return it; PATCH never sets it back.
const accountLocaleSchema = t.Union([localeSchema, t.Null()]);

export const meModule = new Elysia({ prefix: "/api" })
  .get(
    "/me",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);
      const [row] = await db
        .select({
          pixKey: userTable.pixKey,
          emailRemindersOptIn: userTable.emailRemindersOptIn,
          locale: userTable.locale,
        })
        .from(userTable)
        .where(eq(userTable.id, user.id))
        .limit(1);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image ?? null,
        pixKey: row?.pixKey ?? null,
        emailRemindersOptIn: row?.emailRemindersOptIn ?? false,
        locale: isLocale(row?.locale) ? row.locale : null,
        emailRemindersAvailable: emailRemindersEnabled(),
      };
    },
    {
      response: t.Object({
        id: t.String(),
        name: t.String(),
        email: t.String(),
        image: t.Union([t.String(), t.Null()]),
        pixKey: t.Union([t.String(), t.Null()]),
        emailRemindersOptIn: t.Boolean(),
        locale: accountLocaleSchema,
        emailRemindersAvailable: t.Boolean(),
      }),
    }
  )
  .patch(
    "/me",
    async ({ request, body }) => {
      const { user } = await requireAuth(request.headers);
      const patch: {
        pixKey?: string | null;
        emailRemindersOptIn?: boolean;
        locale?: Locale;
      } = {};
      if (body.pixKey !== undefined) {
        patch.pixKey = null;
        if (body.pixKey && body.pixKey.trim() !== "") {
          try {
            patch.pixKey = parsePixKey(body.pixKey).value;
          } catch (e) {
            throw new ValidationError((e as Error).message);
          }
        }
      }
      if (body.emailRemindersOptIn !== undefined) {
        patch.emailRemindersOptIn = body.emailRemindersOptIn;
      }
      if (body.locale !== undefined) {
        patch.locale = body.locale;
      }
      if (Object.keys(patch).length > 0) {
        await db.update(userTable).set(patch).where(eq(userTable.id, user.id));
      }
      const [row] = await db
        .select({
          pixKey: userTable.pixKey,
          emailRemindersOptIn: userTable.emailRemindersOptIn,
          locale: userTable.locale,
        })
        .from(userTable)
        .where(eq(userTable.id, user.id))
        .limit(1);
      return {
        pixKey: row?.pixKey ?? null,
        emailRemindersOptIn: row?.emailRemindersOptIn ?? false,
        locale: isLocale(row?.locale) ? row.locale : null,
      };
    },
    {
      body: t.Object({
        pixKey: t.Optional(t.Union([t.String(), t.Null()])),
        emailRemindersOptIn: t.Optional(t.Boolean()),
        locale: t.Optional(localeSchema),
      }),
      response: t.Object({
        pixKey: t.Union([t.String(), t.Null()]),
        emailRemindersOptIn: t.Boolean(),
        locale: accountLocaleSchema,
      }),
    }
  )
  .post(
    "/me/onboarding/dismiss",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);
      // The first dismissal wins: retries and other tabs keep the original time.
      await db
        .update(userTable)
        .set({ onboardingDismissedAt: new Date() })
        .where(
          and(
            eq(userTable.id, user.id),
            isNull(userTable.onboardingDismissedAt)
          )
        );
      const [row] = await db
        .select({ dismissedAt: userTable.onboardingDismissedAt })
        .from(userTable)
        .where(eq(userTable.id, user.id))
        .limit(1);
      if (!row?.dismissedAt) {
        throw new NotFoundError("Usuário não encontrado");
      }
      return { dismissedAt: row.dismissedAt.toISOString() };
    },
    { response: t.Object({ dismissedAt: t.String() }) }
  );
