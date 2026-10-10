/** The no-break space (U+00A0), by code, so no raw one hides in a test. */
export const NBSP = String.fromCharCode(0xa0);

/**
 * Writes "~" for the no-break space, so an expected line stays readable:
 * nb("parcela~5~de~12"). Every use is still an exact comparison.
 */
export const nb = (text: string): string => text.replaceAll("~", NBSP);
