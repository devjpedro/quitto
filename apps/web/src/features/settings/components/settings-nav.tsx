import {
  Bell,
  CaretRight,
  Database,
  type Icon,
  LockSimple,
  PixLogo,
  SignOut,
  UserCircle,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { IconTile } from "@/components/ui/icon-tile";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Tag } from "@/components/ui/tag";
import { useSignOut } from "@/hooks/use-sign-out";
import { useTheme } from "@/hooks/use-theme";
import { LOCALE_NAME } from "@/lib/locale-names";
import type { SessionUser } from "@/lib/session-resolver";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { SettingsSection } from "../lib/settings-sections";

const ICON: Record<SettingsSection, Icon> = {
  profile: UserCircle,
  pix: PixLogo,
  reminders: Bell,
  security: LockSimple,
  data: Database,
};

function title(section: SettingsSection): string {
  switch (section) {
    case "profile":
      return m.settings_profile();
    case "pix":
      return m.settings_pix();
    case "reminders":
      return m.settings_reminders();
    case "security":
      return m.settings_security();
    default:
      return m.settings_data();
  }
}

/** What each section holds now: the line under its name on a phone, where the list is the page. */
function subtitle(
  section: SettingsSection,
  me: SessionUser,
  theme: "dark" | "light"
): ReactNodeLike {
  switch (section) {
    case "profile":
      return m.settings_sub_profile({
        language: LOCALE_NAME[me.locale ?? getLocale()],
        theme:
          theme === "dark"
            ? m.settings_sub_theme_dark()
            : m.settings_sub_theme_light(),
      });
    case "pix":
      return me.pixKey ? (
        <span className="break-all font-mono">{me.pixKey}</span>
      ) : (
        m.settings_sub_pix_none()
      );
    case "reminders":
      return me.emailRemindersOptIn
        ? m.settings_sub_reminders_on()
        : m.settings_sub_reminders_off();
    case "security":
      return me.hasPassword
        ? m.settings_sub_security()
        : m.settings_sub_security_google();
    default:
      return m.settings_sub_data();
  }
}

type ReactNodeLike = string | React.ReactElement;

/**
 * The sections of Ajustes (mockup 18, decision 1). From md, a list beside the
 * open section: the selected row is tinted across its width, and "Recebimento"
 * carries a "sem chave" tag while there is none. On a phone it is the page
 * itself: cards with what each holds, and "Sair" at the end.
 */
export function SettingsNav({
  me,
  sections,
  selected,
}: {
  me: SessionUser;
  sections: SettingsSection[];
  selected: SettingsSection;
}) {
  const { theme } = useTheme();
  const signOut = useSignOut();
  return (
    <nav aria-label={m.settings_nav_label()}>
      <ul className="divide-y divide-divider overflow-hidden rounded-card bg-surface-card md:flex md:flex-col md:gap-1 md:divide-y-0 md:overflow-visible md:rounded-none md:bg-transparent">
        {sections.map((section) => {
          const active = section === selected;
          const Glyph = ICON[section];
          return (
            <li key={section}>
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-[68px] items-center gap-3.5 px-3.5 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset md:min-h-11 md:gap-3 md:rounded-control md:px-3 md:py-0",
                  "max-md:hover:bg-surface-card-hover md:hover:bg-surface-card",
                  active && "md:bg-surface-card"
                )}
                params={{ section }}
                to="/settings/$section"
              >
                <span className="md:hidden">
                  {section === "profile" ? (
                    <PersonAvatar name={me.name} self size="lg" />
                  ) : (
                    <IconTile icon={Glyph} tone="neutral" />
                  )}
                </span>
                <Glyph
                  aria-hidden="true"
                  className="hidden shrink-0 md:block"
                  size={18}
                  weight={active ? "fill" : "regular"}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm",
                      active ? "md:font-semibold" : "md:font-medium",
                      "max-md:font-medium"
                    )}
                  >
                    {title(section)}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-ink-muted md:hidden">
                    {subtitle(section, me, theme)}
                  </span>
                </span>
                {section === "pix" && !me.pixKey ? (
                  <Tag className="max-md:hidden" tone="warning">
                    {m.settings_pix_no_key_tag()}
                  </Tag>
                ) : null}
                <CaretRight
                  aria-hidden="true"
                  className="text-ink-muted md:hidden"
                  size={16}
                />
              </Link>
            </li>
          );
        })}
      </ul>
      <button
        className="mt-3 flex min-h-[60px] w-full items-center gap-3.5 rounded-card bg-surface-card px-3.5 text-left font-medium text-sm transition-colors hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:hidden"
        onClick={signOut}
        type="button"
      >
        <IconTile icon={SignOut} tone="neutral" />
        {m.account_sign_out()}
      </button>
    </nav>
  );
}
