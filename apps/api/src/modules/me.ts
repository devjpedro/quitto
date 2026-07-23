import { parsePixKey } from "@quitto/shared";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "../db/client";
import { user as userTable } from "../db/schema";
import { ValidationError } from "../lib/errors";
import { requireAuth } from "../lib/session";

export const meModule = new Elysia({ prefix: "/api" })
  .get(
    "/me",
    async ({ request }) => {
      const { user } = await requireAuth(request.headers);
      const [row] = await db
        .select({ pixKey: userTable.pixKey })
        .from(userTable)
        .where(eq(userTable.id, user.id))
        .limit(1);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image ?? null,
        pixKey: row?.pixKey ?? null,
      };
    },
    {
      response: t.Object({
        id: t.String(),
        name: t.String(),
        email: t.String(),
        image: t.Union([t.String(), t.Null()]),
        pixKey: t.Union([t.String(), t.Null()]),
      }),
    }
  )
  .patch(
    "/me",
    async ({ request, body }) => {
      const { user } = await requireAuth(request.headers);
      let pixKey: string | null = null;
      if (body.pixKey && body.pixKey.trim() !== "") {
        try {
          pixKey = parsePixKey(body.pixKey).value;
        } catch (e) {
          throw new ValidationError((e as Error).message);
        }
      }
      await db
        .update(userTable)
        .set({ pixKey })
        .where(eq(userTable.id, user.id));
      return { pixKey };
    },
    {
      body: t.Object({ pixKey: t.Union([t.String(), t.Null()]) }),
      response: t.Object({ pixKey: t.Union([t.String(), t.Null()]) }),
    }
  );
