import { cors } from "@elysiajs/cors";
import { captureException } from "@sentry/bun";
import { Elysia, t } from "elysia";
import { auth } from "./auth";
import { runReminderSweep } from "./cron/reminders";
import { env } from "./env";
import {
  AppError,
  NotFoundError,
  toErrorBody,
  UnauthorizedError,
} from "./lib/errors";
import { accountModule } from "./modules/account";
import { contractDetailModule } from "./modules/contract-detail";
import { contractsModule } from "./modules/contracts";
import { dashboardModule } from "./modules/dashboard";
import { documentsModule } from "./modules/documents";
import { homeModule } from "./modules/home";
import { installmentsModule } from "./modules/installments";
import { internalCronModule } from "./modules/internal-cron";
import { invitesModule } from "./modules/invites";
import { meModule } from "./modules/me";
import { notificationsModule } from "./modules/notifications";
import { participantsModule } from "./modules/participants";
import { paymentsModule } from "./modules/payments";
import { receiptSharesModule } from "./modules/receipt-shares";

const apiRoutes = new Elysia({ prefix: "/api" }).get(
  "/ping",
  () => ({ status: "ok" as const, service: "quitto-api" }),
  { response: t.Object({ status: t.Literal("ok"), service: t.String() }) }
);

export function buildApp() {
  return new Elysia()
    .onError(async ({ code, error, request, set }) => {
      if (error instanceof AppError) {
        set.status = error.httpStatus;
        return toErrorBody(error);
      }
      // A malformed id in the path (each one is a uuid, lib/route-params): for
      // the caller it is "not found", as an id it may not see is; a cut link
      // lands on the web's "não encontrado". The check runs before the
      // handler, so the session is asked here: every route with an id needs
      // one, and without it the answer stays 401. A bad body or query stays 422.
      if (code === "VALIDATION" && error.type === "params") {
        const session = await auth.api.getSession({ headers: request.headers });
        const answer = session ? new NotFoundError() : new UnauthorizedError();
        set.status = answer.httpStatus;
        return toErrorBody(answer);
      }
      captureException(error);
    })
    .use(cors({ origin: env.WEB_ORIGIN, credentials: true }))
    .mount(auth.handler)
    .use(apiRoutes)
    .use(meModule)
    .use(contractsModule)
    .use(contractDetailModule)
    .use(paymentsModule)
    .use(installmentsModule)
    .use(documentsModule)
    .use(receiptSharesModule)
    .use(participantsModule)
    .use(invitesModule)
    .use(notificationsModule)
    .use(dashboardModule)
    .use(homeModule)
    .use(accountModule)
    .use(
      internalCronModule({
        secret: env.CRON_SECRET,
        run: () => runReminderSweep(),
      })
    );
}

export const app = buildApp();
export type App = typeof app;
