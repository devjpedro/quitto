import { Elysia, t } from "elysia";
import { requireAuth } from "../lib/session";

export const meModule = new Elysia({ prefix: "/api" }).get(
  "/me",
  async ({ request }) => {
    const { user } = await requireAuth(request.headers);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
    };
  },
  {
    response: t.Object({
      id: t.String(),
      name: t.String(),
      email: t.String(),
      image: t.Union([t.String(), t.Null()]),
    }),
  }
);
