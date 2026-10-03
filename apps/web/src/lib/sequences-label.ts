import type { Locale } from "@quitto/shared";
import { m } from "@/paraglide/messages.js";

const listFormatters = new Map<Locale, Intl.ListFormat>();

function listFormatter(locale: Locale): Intl.ListFormat {
  let formatter = listFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.ListFormat(locale, { type: "conjunction" });
    listFormatters.set(locale, formatter);
  }
  return formatter;
}

function isRun(sorted: number[]): boolean {
  return sorted.every(
    (value, i) => i === 0 || value === (sorted[i - 1] as number) + 1
  );
}

/** "3 e 4", "5 a 28", "3, 5 e 9": installment numbers in order, a run of 3 or more as a range. */
export function sequencesList(sequences: number[], locale: Locale): string {
  const sorted = [...sequences].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted.at(-1);
  if (
    sorted.length >= 3 &&
    isRun(sorted) &&
    first !== undefined &&
    last !== undefined
  ) {
    return m.home_sequence_range({ from: first, to: last }, { locale });
  }
  return listFormatter(locale).format(sorted.map(String));
}

/** "parcela 5 de 12", "parcelas 3 e 4 de 12", "parcelas 5 a 28 de 60". */
export function sequencesLabel(
  sequences: number[],
  count: number,
  locale: Locale
): string {
  const [only] = sequences;
  if (sequences.length === 1 && only !== undefined) {
    return m.home_installment_one({ sequence: only, count }, { locale });
  }
  return m.home_installments_of(
    { list: sequencesList(sequences, locale), count },
    { locale }
  );
}
