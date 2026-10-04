import type { Locale } from "@quitto/shared";
import { m } from "@/paraglide/messages.js";

/** A run this long or longer reads as a range ("5 a 28"); a shorter one shows each number. */
const RANGE_MIN = 3;
/** Past this many items the list stops being readable: say how many and between which. */
const LIST_MAX_ITEMS = 3;

const listFormatters = new Map<Locale, Intl.ListFormat>();

function listFormatter(locale: Locale): Intl.ListFormat {
  let formatter = listFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.ListFormat(locale, { type: "conjunction" });
    listFormatters.set(locale, formatter);
  }
  return formatter;
}

/** Sorted numbers cut into runs of consecutive ones: [3, 4, 6] → [[3, 4], [6]]. */
function runsOf(sorted: number[]): number[][] {
  const runs: number[][] = [];
  for (const value of sorted) {
    const run = runs.at(-1);
    if (run && value === (run.at(-1) as number) + 1) {
      run.push(value);
    } else {
      runs.push([value]);
    }
  }
  return runs;
}

/** What the list shows: a run of 3 or more as one range, a shorter run number by number. */
function listItems(sequences: number[], locale: Locale): string[] {
  const sorted = [...sequences].sort((a, b) => a - b);
  return runsOf(sorted).flatMap((run) => {
    const from = run[0] as number;
    const to = run.at(-1) as number;
    return run.length >= RANGE_MIN
      ? [m.home_sequence_range({ from, to }, { locale })]
      : run.map(String);
  });
}

/** The list itself, or how many there are and between which. */
export type SequencesText =
  | { kind: "list"; text: string }
  | { first: number; kind: "spread"; last: number; n: number };

/**
 * A group's installment numbers, ready for a message: the list ("3 e 4",
 * "5 a 12 e 14 a 28") while it has at most 3 items, or how many there are and
 * between which ("7 parcelas entre 3 e 28") past that.
 */
export function sequencesText(
  sequences: number[],
  locale: Locale
): SequencesText {
  const items = listItems(sequences, locale);
  if (items.length > LIST_MAX_ITEMS) {
    return {
      kind: "spread",
      n: sequences.length,
      first: Math.min(...sequences),
      last: Math.max(...sequences),
    };
  }
  return { kind: "list", text: listFormatter(locale).format(items) };
}

/** "parcela 5 de 12", "parcelas 3 e 4 de 12", "parcelas 5 a 12 e 14 a 28 de 60", "7 parcelas entre 3 e 28 de 60". */
export function sequencesLabel(
  sequences: number[],
  count: number,
  locale: Locale
): string {
  const [only] = sequences;
  if (sequences.length === 1 && only !== undefined) {
    return m.home_installment_one({ sequence: only, count }, { locale });
  }
  const text = sequencesText(sequences, locale);
  if (text.kind === "spread") {
    const { first, last, n } = text;
    return m.home_installments_spread({ n, first, last, count }, { locale });
  }
  return m.home_installments_of({ list: text.text, count }, { locale });
}
