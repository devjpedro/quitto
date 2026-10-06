import type { Locale } from "@quitto/shared";
import { formatDate, formatMoney, normalizeSpaces } from "@/lib/locale-format";
import { sequencesText } from "@/lib/sequences-label";
import { m } from "@/paraglide/messages.js";

export interface ChargeMessageInput {
  amountCents: number;
  contractTitle: string;
  dueDate: string;
  installmentsCount: number;
  pixCode: string | null;
  sequence: number;
  todayISO: string;
}

/**
 * Paragraphs of the "Cobrar no WhatsApp" message, in the sender's language:
 * the installment with its amount and due date, then the Pix copy-and-paste
 * code when the receiver has a key. A paid installment's receipt link is
 * receiptMessage's.
 */
export function chargeMessage(
  input: ChargeMessageInput,
  locale: Locale
): string[] {
  const params = {
    title: input.contractTitle,
    sequence: input.sequence,
    count: input.installmentsCount,
    amount: formatMoney(input.amountCents, locale),
    date: formatDate(input.dueDate, locale, "short"),
  };
  const opening =
    input.dueDate < input.todayISO
      ? m.whatsapp_charge_overdue(params, { locale })
      : m.whatsapp_charge_upcoming(params, { locale });
  return input.pixCode
    ? [opening, m.whatsapp_pix_intro({}, { locale }), input.pixCode]
    : [opening];
}

export interface GroupChargeInput {
  contractTitle: string;
  /** The oldest overdue installment's due date. */
  dueDate: string;
  sequences: number[];
  totalCents: number;
}

/**
 * "Cobrar no WhatsApp" for a group of overdue installments: every one of
 * them (or, past 3 items, how many and between which), the total and the
 * oldest's due date. No Pix code: a code carries one amount, and the group is
 * many. The range keeps our screen's no-break spaces ("5 a 12") out: what
 * leaves for another app is plain text.
 */
export function groupChargeMessage(
  input: GroupChargeInput,
  locale: Locale
): string[] {
  const params = {
    title: input.contractTitle,
    total: formatMoney(input.totalCents, locale),
    date: formatDate(input.dueDate, locale, "short"),
  };
  const text = sequencesText(input.sequences, locale);
  if (text.kind === "spread") {
    const { first, last, n } = text;
    return [
      m.whatsapp_charge_group_spread({ ...params, n, first, last }, { locale }),
    ];
  }
  return [
    m.whatsapp_charge_group(
      { ...params, list: normalizeSpaces(text.text) },
      { locale }
    ),
  ];
}

export interface ReceiptMessageInput {
  amountCents: number;
  contractTitle: string;
  installmentsCount: number;
  /** Who sends it: the receiver says "Recebi…", the payer "Paguei…" (review I7). */
  perspective: "receive" | "pay";
  sequence: number;
  url: string;
}

/** "Parcela paga" (spec §4.2): the receipt's sentence and its public link. */
export function receiptMessage(
  input: ReceiptMessageInput,
  locale: Locale
): string[] {
  const params = {
    sequence: input.sequence,
    count: input.installmentsCount,
    title: input.contractTitle,
    amount: formatMoney(input.amountCents, locale),
  };
  const sentence =
    input.perspective === "receive"
      ? m.whatsapp_receipt(params, { locale })
      : m.whatsapp_receipt_paid(params, { locale });
  return [sentence, input.url];
}

/** wa.me without a number: the sender picks the contact inside WhatsApp. One blank line between paragraphs. */
export function whatsappUrl(paragraphs: string[]): string {
  return `https://wa.me/?text=${paragraphs.map(encodeURIComponent).join("%0A%0A")}`;
}
