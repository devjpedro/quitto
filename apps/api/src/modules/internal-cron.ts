import { timingSafeEqual } from "node:crypto";
import { Elysia } from "elysia";
import type { SweepResult } from "../cron/reminders";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Disparo diário da varredura de lembretes (GitHub Actions → Fly). Sem secret
 * configurado o endpoint "não existe" (404). Responde direto via `set.status`
 * pra não depender do onError do app (o módulo é testável isolado).
 */
export function internalCronModule(opts: {
  secret: string | undefined;
  run: () => Promise<SweepResult>;
}) {
  return new Elysia({ prefix: "/api/internal" }).post(
    "/cron/reminders",
    async ({ request, set }) => {
      if (!opts.secret) {
        set.status = 404;
        return { error: { code: "NOT_FOUND", message: "Not found" } };
      }
      const header = request.headers.get("authorization") ?? "";
      if (!safeEqual(header, `Bearer ${opts.secret}`)) {
        set.status = 401;
        return { error: { code: "UNAUTHORIZED", message: "Unauthorized" } };
      }
      return await opts.run();
    }
  );
}
