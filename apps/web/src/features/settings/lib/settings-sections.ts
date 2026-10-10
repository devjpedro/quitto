export const SETTINGS_SECTIONS = [
  "profile",
  "pix",
  "reminders",
  "security",
  "data",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: string): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

/** The sections this account has: Lembretes only exists with the global e-mail switch on. */
export function availableSections(me: {
  emailRemindersAvailable: boolean;
}): SettingsSection[] {
  return SETTINGS_SECTIONS.filter(
    (section) => section !== "reminders" || me.emailRemindersAvailable
  );
}
