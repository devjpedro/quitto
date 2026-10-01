import { env } from "../env";

/** Chave global (env) que liga o envio/oferta de lembretes por e-mail. */
export function emailRemindersEnabled(): boolean {
  return env.EMAIL_REMINDERS_ENABLED === "true";
}
