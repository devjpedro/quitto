import { Compass } from "@phosphor-icons/react";
import { LOCALES, type Locale, todayISO } from "@quitto/shared";
import { useHydrated } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { useSetTourCompleted } from "@/features/tour/api";
import { tourStore } from "@/features/tour/lib/tour-store";
import { useChangeLocale } from "@/hooks/use-change-locale";
import { useTheme } from "@/hooks/use-theme";
import { formatDate, formatMoney, formatMonthYear } from "@/lib/locale-format";
import { LOCALE_NAME } from "@/lib/locale-names";
import type { SessionUser } from "@/lib/session-resolver";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { ChoiceCard, ChoiceGroup, ThumbnailCard } from "./choice-cards";
import { SettingsSectionShell } from "./settings-block";
import { ThemePicture } from "./theme-picture";

/** An amount that shows the money's format in each language, the same for everyone. */
const SAMPLE_CENTS = 125_000;

function groupTitle(text: string, hint?: string) {
  return (
    <h3 className="mt-7 mb-3 flex flex-wrap items-baseline gap-x-3 font-semibold text-sm">
      {text}
      {hint ? (
        <span className="font-normal text-[13px] text-ink-muted">{hint}</span>
      ) : null}
    </h3>
  );
}

/** Perfil: who you are, the language (with the date and the money in it) and the theme (with the app in miniature). */
export function ProfileSection({ me }: { me: SessionUser }) {
  const changeLocale = useChangeLocale();
  const setTourCompleted = useSetTourCompleted();
  const { theme, setTheme } = useTheme();
  // The server does not know the <html> class's theme: marked only after hydrating.
  const hydrated = useHydrated();
  const current = me.locale ?? getLocale();
  const today = todayISO();
  return (
    <SettingsSectionShell id="profile" title={m.settings_profile()}>
      <div className="flex items-center gap-4 rounded-card bg-surface-card p-4">
        <PersonAvatar name={me.name} self size="lg" />
        <div className="min-w-0">
          <p className="truncate font-display font-semibold text-lg leading-tight tracking-[-0.02em]">
            {me.name}
          </p>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            <span className="break-all">{me.email}</span>
            {" · "}
            {m.settings_member_since({
              month: formatMonthYear(me.createdAt, getLocale()),
            })}
          </p>
        </div>
      </div>

      {groupTitle(m.settings_language(), m.settings_language_hint())}
      <ChoiceGroup
        label={m.settings_language()}
        onValueChange={(value) => changeLocale(value as Locale)}
        stacked
        value={current}
      >
        {LOCALES.map((locale) => (
          <ChoiceCard
            example={`${formatDate(today, locale, "weekdayDay")} · ${formatMoney(SAMPLE_CENTS, locale)}`}
            key={locale}
            title={LOCALE_NAME[locale]}
            value={locale}
          />
        ))}
      </ChoiceGroup>

      {groupTitle(m.settings_theme())}
      <ChoiceGroup
        label={m.settings_theme()}
        onValueChange={(value) => setTheme(value === "dark" ? "dark" : "light")}
        value={hydrated ? theme : ""}
      >
        <ThumbnailCard
          picture={<ThemePicture theme="light" />}
          title={m.settings_theme_light()}
          value="light"
        />
        <ThumbnailCard
          picture={<ThemePicture theme="dark" />}
          title={m.settings_theme_dark()}
          value="dark"
        />
      </ChoiceGroup>

      {groupTitle(m.settings_tour_title(), m.settings_tour_description())}
      <Button
        onClick={() => {
          // Clears the "seen" mark (a new device sees it again too) and opens it here.
          setTourCompleted.mutate(false);
          tourStore.start();
        }}
        variant="inset"
      >
        <Compass aria-hidden="true" size={16} />
        {m.settings_tour_redo()}
      </Button>
    </SettingsSectionShell>
  );
}
