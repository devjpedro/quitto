import type { Locale } from "@quitto/shared";

const rules = new Map<Locale, Intl.PluralRules>();

/**
 * CLDR plural category, reduced to the two forms our messages carry (`_one` /
 * `_other`). Careful: pt-BR puts 0 in "one" (CLDR), so a `_one` message that
 * says "1" must only be reached after the caller has ruled out zero.
 */
export function pluralForm(count: number, locale: Locale): "one" | "other" {
  let rule = rules.get(locale);
  if (!rule) {
    rule = new Intl.PluralRules(locale);
    rules.set(locale, rule);
  }
  return rule.select(count) === "one" ? "one" : "other";
}
