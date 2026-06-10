import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { auth } from "./auth";
import { env } from "./env";

const apiRoutes = new Elysia({ prefix: "/api" }).get(
  "/ping",
  () => ({ status: "ok" as const, service: "quitto-api" }),
  { response: t.Object({ status: t.Literal("ok"), service: t.String() }) }
);

export function buildApp() {
  return new Elysia()
    .use(cors({ origin: env.WEB_ORIGIN, credentials: true }))
    .mount(auth.handler)
    .use(apiRoutes);
}

export const app = buildApp();
export type App = typeof app;
