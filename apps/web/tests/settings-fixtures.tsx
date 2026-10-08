import { SettingsPage } from "../src/features/settings/components/settings-page";
import type { SettingsSection } from "../src/features/settings/lib/settings-sections";
import { queryKeys } from "../src/lib/query-keys";
import type { SessionUser } from "../src/lib/session-resolver";
import { makeTestQueryClient, renderWithProviders } from "./test-utils";

/** An account for Ajustes: a password, a PIX key to set, e-mail reminders available but off. */
export const ME: SessionUser = {
  id: "u1",
  name: "João Souza",
  email: "agora@demo.quitto.dev",
  image: null,
  createdAt: "2025-09-12T15:00:00.000Z",
  emailRemindersAvailable: true,
  emailRemindersOptIn: false,
  hasPassword: true,
  locale: null,
  pixKey: null,
  tourCompletedAt: "2025-09-12T15:30:00.000Z",
};

/** Ajustes with /me already in the cache (so nothing is fetched) and the account as given. */
export function renderSettings(
  section: SettingsSection | null,
  me: Partial<SessionUser> = {}
) {
  const client = makeTestQueryClient();
  client.setQueryData(queryKeys.me, { ...ME, ...me });
  client.setQueryDefaults(queryKeys.me, {
    staleTime: Number.POSITIVE_INFINITY,
  });
  return renderWithProviders(<SettingsPage section={section} />, { client });
}
