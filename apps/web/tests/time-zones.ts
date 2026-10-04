import { vi } from "vitest";

/**
 * The machine's timezone must never move a date, and the tests pin it so
 * they prove that on any machine, a CI runner in UTC included: São Paulo
 * (behind UTC) catches a UTC midnight shown in local time, Tokyo (ahead of
 * it) catches a local midnight read back as UTC.
 */
export const ZONES = ["America/Sao_Paulo", "Asia/Tokyo"] as const;

/**
 * Puts the machine in `zone` and imports a fresh copy of the module, since
 * its Intl formatters are cached from the first call. Undo it with
 * `vi.unstubAllEnvs()` in an afterEach.
 */
export async function importInZone<T>(
  zone: string,
  load: () => Promise<T>
): Promise<T> {
  vi.stubEnv("TZ", zone);
  vi.resetModules();
  const applied = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (applied !== zone) {
    throw new Error(
      `TZ=${zone} não pegou (${applied}): o teste não provaria nada`
    );
  }
  return await load();
}
