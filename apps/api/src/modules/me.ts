import { parsePixKey } from "@quitto/shared";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { user as userTable } from "../db/schema";
import { emailRemindersEnabled } from "../lib/email-reminders";
import { ValidationError } from "../lib/errors";
import { requireAuth } from "../lib/session";

export const meModule = new Elysia({ prefix: "/api" })
  .get(
    "/me",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);
      const [row] = await db
        .select({
          pixKey: userTable.pixKey,
          emailRemindersOptIn: userTable.emailRemindersOptIn,
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
        emailRemindersAvailable: t.Boolean(),
      }),
    }
  )
  .patch(
    "/me",
    async ({ request, body }) => {
      const { user } = await requireAuth(request.headers);
      const patch: { pixKey?: string | null; emailRemindersOptIn?: boolean } =
        {};
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
      if (Object.keys(patch).length > 0) {
        await db.update(userTable).set(patch).where(eq(userTable.id, user.id));
      }
      const [row] = await db
        .select({
          pixKey: userTable.pixKey,
          emailRemindersOptIn: userTable.emailRemindersOptIn,
        })
        .from(userTable)
        .where(eq(userTable.id, user.id))
        .limit(1);
      return {
        pixKey: row?.pixKey ?? null,
        emailRemindersOptIn: row?.emailRemindersOptIn ?? false,
      };
    },
    {
      body: t.Object({
        pixKey: t.Optional(t.Union([t.String(), t.Null()])),
        emailRemindersOptIn: t.Optional(t.Boolean()),
      }),
      response: t.Object({
        pixKey: t.Union([t.String(), t.Null()]),
        emailRemindersOptIn: t.Boolean(),
      }),
    }
  );
