import type { Locale } from "@quitto/shared";
import { formatDate, formatMoney } from "@/lib/locale-format";
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
 * code when the receiver has a key. The receipt link of a paid installment
 * comes with the receipt work (Fase 2).
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

/** wa.me without a number: the sender picks the contact inside WhatsApp. One blank line between paragraphs. */
export function whatsappUrl(paragraphs: string[]): string {
  return `https://wa.me/?text=${paragraphs.map(encodeURIComponent).join("%0A%0A")}`;
}
