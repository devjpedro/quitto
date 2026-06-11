import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { auth } from "./auth";
import { env } from "./env";
import { AppError, toErrorBody } from "./lib/errors";
import { contractsModule } from "./modules/contracts";
import { meModule } from "./modules/me";
import { paymentsModule } from "./modules/payments";

const apiRoutes = new Elysia({ prefix: "/api" }).get(
  "/ping",
  () => ({ status: "ok" as const, service: "quitto-api" }),
  { response: t.Object({ status: t.Literal("ok"), service: t.String() }) }
);

export function buildApp() {
  return new Elysia()
    .onError(({ error, set }) => {
      if (error instanceof AppError) {
        set.status = error.httpStatus;
        return toErrorBody(error);
      }
    })
    .use(cors({ origin: env.WEB_ORIGIN, credentials: true }))
    .mount(auth.handler)
    .use(apiRoutes)
    .use(meModule)
    .use(contractsModule)
    .use(paymentsModule);
}

export const app = buildApp();
export type App = typeof app;
