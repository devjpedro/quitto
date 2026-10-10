import { isPaidStatus, type Locale } from "@quitto/shared";
import { formatMoney } from "@/lib/locale-format";
import { pluralForm } from "@/lib/plural";
import { m } from "@/paraglide/messages.js";

export type Perspective = "receive" | "pay" | "view";

export function perspectiveOf(role: string): Perspective {
  if (role === "seller") {
    return "receive";
  }
  return role === "buyer" ? "pay" : "view";
}

export function isSettled(items: { status: string }[]): boolean {
  return items.length > 0 && items.every((it) => isPaidStatus(it.status));
}

/** The contract's big number: what is left, of the total; settled, the total itself. */
export function heroView(
  detail: {
    installments: { status: string }[];
    progress: { remainingCents: number; totalCents: number };
  },
  perspective: Perspective
): { cents: number; label: string; ofCents: number | null } {
  if (isSettled(detail.installments)) {
    let settled = m.contract_hero_settled();
    if (perspective === "receive") {
      settled = m.contract_hero_received();
    } else if (perspective === "pay") {
      settled = m.contract_hero_paid();
    }
    return { label: settled, cents: detail.progress.totalCents, ofCents: null };
  }
  let left = m.contract_hero_left_view();
  if (perspective === "receive") {
    left = m.contract_hero_left_receive();
  } else if (perspective === "pay") {
    left = m.contract_hero_left_pay();
  }
  return {
    label: left,
    cents: detail.progress.remainingCents,
    ofCents: detail.progress.totalCents,
  };
}

function lastDayOfMonth(iso: string): number {
  const [y, mo] = iso.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** The contract's terms, said once, on the line under the title (DIRECAO › Contrato). */
export function termsLine(
  items: { amountCents: number; dueDate: string }[],
  requiresConfirmation: boolean,
  locale: Locale
): string {
  const options = { locale };
  const [first] = items;
  if (!first) {
    return "";
  }
  const sameAmount = items.every((it) => it.amountCents === first.amountCents);
  const day = Number(first.dueDate.slice(8, 10));
  const sameDay =
    items.length > 1 &&
    items.every(
      (it) =>
        Number(it.dueDate.slice(8, 10)) ===
        Math.min(day, lastDayOfMonth(it.dueDate))
    );
  const total = items.reduce((sum, it) => sum + it.amountCents, 0);
  let amount: string;
  if (sameAmount && sameDay) {
    amount = m.contract_terms_monthly(
      { amount: formatMoney(first.amountCents, locale), day },
      options
    );
  } else if (sameAmount) {
    amount = m.contract_terms_each(
      { amount: formatMoney(first.amountCents, locale) },
      options
    );
  } else {
    amount = m.contract_terms_total(
      { amount: formatMoney(total, locale) },
      options
    );
  }
  const count =
    pluralForm(items.length, locale) === "one"
      ? m.contract_terms_count_one({}, options)
      : m.contract_terms_count_other({ count: items.length }, options);
  const parts = [amount, count];
  if (requiresConfirmation) {
    parts.push(m.contract_terms_confirmation({}, options));
  }
  return parts.reduce((left, right) =>
    m.contract_join({ left, right }, options)
  );
}

export type CounterpartLine =
  | { kind: "receive" | "pay"; name: string }
  | { kind: "view"; payer: string | null; receiver: string | null }
  | { kind: "alone" };

/** Who the other side is: the payer to whoever receives, the receiver to whoever pays, both to a viewer. */
export function counterpartLine(
  participants: { displayName: string; role: string }[],
  perspective: Perspective
): CounterpartLine {
  const payer =
    participants.find((p) => p.role === "buyer")?.displayName ?? null;
  const receiver =
    participants.find((p) => p.role === "seller")?.displayName ?? null;
  if (perspective === "view") {
    return { kind: "view", payer, receiver };
  }
  const name = perspective === "receive" ? payer : receiver;
  return name ? { kind: perspective, name } : { kind: "alone" };
}
