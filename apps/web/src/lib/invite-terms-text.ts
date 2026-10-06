import type { Locale } from "@quitto/shared";
import { sinceDate } from "@/lib/date-parts";
import { formatMoney } from "@/lib/locale-format";
import { pluralForm } from "@/lib/plural";
import { m } from "@/paraglide/messages.js";

/** The terms the phrase needs: a home invite card, an invite page, a public preview. */
export interface InviteTermsInput {
  amountCents: number | null;
  firstDueDate: string | null;
  installmentsCount: number;
  totalCents: number;
}

/** "4 parcelas de R$ 300,00 · a partir de 10/11" (the home card and the invite page), with the year when it is another one; the total when the amounts differ. */
export function inviteTerms(
  terms: InviteTermsInput,
  today: string,
  locale: Locale
): { amount: string; from: string | null } {
  const options = { locale };
  const count = terms.installmentsCount;
  let amount: string;
  if (terms.amountCents === null) {
    amount = m.home_invite_terms_total(
      { count, amount: formatMoney(terms.totalCents, locale) },
      options
    );
  } else {
    const each = formatMoney(terms.amountCents, locale);
    amount =
      pluralForm(count, locale) === "one"
        ? m.home_invite_terms_each_one({ amount: each }, options)
        : m.home_invite_terms_each_other({ count, amount: each }, options);
  }
  return {
    amount,
    from: terms.firstDueDate
      ? m.home_invite_terms_from(
          { date: sinceDate(terms.firstDueDate, today, locale) },
          options
        )
      : null,
  };
}
