import { LOCALES, type Locale } from "@quitto/shared";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { LOCALE_NAME, LOCALE_SHORT_NAME } from "@/lib/locale-names";
import { m } from "@/paraglide/messages.js";

const OPTIONS = LOCALES.map((locale) => ({
  value: locale,
  label: LOCALE_SHORT_NAME[locale],
  ariaLabel: LOCALE_NAME[locale],
}));

/**
 * The language switch (mockup 18, decision 3; mockup 19, decision 6): the
 * two endonyms in a segmented control. Where it goes is the caller's: on the
 * showcase it only sets the cookie and reloads; in Ajustes and the ⌘K it
 * saves on the account first (`useChangeLocale`).
 */
export function LocaleSwitch({
  block,
  onChange,
  tone,
  value,
}: {
  block?: boolean | "mobile";
  onChange: (locale: Locale) => void;
  tone?: "default" | "onBrand";
  value: Locale;
}) {
  return (
    <SegmentedControl
      block={block}
      label={m.auth_language()}
      onValueChange={onChange}
      options={OPTIONS}
      tone={tone}
      value={value}
    />
  );
}
