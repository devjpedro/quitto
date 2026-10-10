import { useSuspenseQuery } from "@tanstack/react-query";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { meQueryOptions } from "@/hooks/use-me";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import {
  availableSections,
  type SettingsSection,
} from "../lib/settings-sections";
import { DataSection } from "./data-section";
import { PixSection } from "./pix-section";
import { ProfileSection } from "./profile-section";
import { RemindersSection } from "./reminders-section";
import { SecuritySection } from "./security-section";
import { SettingsNav } from "./settings-nav";
import { SettingsSkeleton } from "./settings-skeleton";

function SettingsBody({ section }: { section: SettingsSection | null }) {
  const { data: me } = useSuspenseQuery(meQueryOptions);
  const sections = availableSections(me);
  // A section this account does not have (Lembretes without the switch) is the list again.
  const open = section && sections.includes(section) ? section : null;
  // From md the list always has one open: the profile, when none is named.
  const shown = open ?? "profile";
  return (
    <div className="md:grid md:grid-cols-[240px_minmax(0,560px)] md:gap-x-10">
      <div className={cn(open && "max-md:hidden")}>
        <SettingsNav me={me} sections={sections} selected={shown} />
      </div>
      <div className={cn("min-w-0", !open && "max-md:hidden")}>
        {shown === "profile" ? <ProfileSection me={me} /> : null}
        {shown === "pix" ? <PixSection me={me} /> : null}
        {shown === "reminders" ? <RemindersSection me={me} /> : null}
        {shown === "security" ? <SecuritySection me={me} /> : null}
        {shown === "data" ? <DataSection /> : null}
      </div>
    </div>
  );
}

/**
 * /settings and /settings/$section (mockup 18, decision 1): one section at a
 * time, the list beside it. On a phone the list is the page and a section is
 * a screen with "‹ Ajustes" in the top bar. The route names the section.
 */
export function SettingsPage({ section }: { section: SettingsSection | null }) {
  useDocumentTitle(m.page_title_settings());
  return (
    <div className="lateral:p-8 p-4 md:p-6">
      <div className="max-w-[880px]">
        <h1
          className={cn(
            "mb-5 font-bold font-display text-[28px] leading-tight tracking-[-0.035em] md:mb-6 md:text-[32px]",
            section && "max-md:sr-only"
          )}
        >
          {m.settings_title()}
        </h1>
        <SectionBoundary fallback={<SettingsSkeleton />}>
          <SettingsBody section={section} />
        </SectionBoundary>
      </div>
    </div>
  );
}
