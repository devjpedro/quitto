import type { Locale } from "@quitto/shared";
import { pluralForm } from "@/lib/plural";
import { m } from "@/paraglide/messages.js";
import type { Person, PersonContract } from "../types";

export interface PersonTag {
  icon: "overdue" | "review" | "ok";
  label: string;
  tone: "brand" | "danger" | "warning";
}

export interface PersonBalance {
  cents: number;
  direction: "pay" | "receive";
  label: string;
}

export interface PersonView {
  accountText: string | null;
  balances: PersonBalance[];
  contractsLine: string;
  tag: PersonTag;
}

function accountText(account: Person["account"]): string | null {
  if (account === "invited") {
    return m.people_invite_pending();
  }
  return account === "none" ? m.people_name_only() : null;
}

function contractsLine(person: Person, locale: Locale): string {
  const count = person.contracts.length;
  const lead =
    count > 0 && pluralForm(count, locale) === "one"
      ? m.people_page_contracts_one()
      : m.people_page_contracts_other({ count });
  const titles = person.contracts.map((c) => c.title).join(", ");
  // One contract: its title alone says it all ("Aluguel da sala"); more: "2 contratos".
  return count === 1 ? titles : lead;
}

function tagOf(person: Person, locale: Locale): PersonTag {
  if (person.overdueCount > 0) {
    return {
      icon: "overdue",
      tone: "danger",
      label:
        pluralForm(person.overdueCount, locale) === "one"
          ? m.people_page_overdue_one()
          : m.people_page_overdue_other({ count: person.overdueCount }),
    };
  }
  if (person.reviewCount > 0) {
    return {
      icon: "review",
      tone: "warning",
      label:
        pluralForm(person.reviewCount, locale) === "one"
          ? m.people_page_review_one()
          : m.people_page_review_other({ count: person.reviewCount }),
    };
  }
  const open = person.owesYouCents > 0 || person.youOweCents > 0;
  return {
    icon: "ok",
    tone: "brand",
    label: open ? m.people_page_on_track() : m.people_page_settled(),
  };
}

/** What a person's card and sheet draw: the account text, the contracts line, the tag and the balances (receive first, never summed). */
export function personView(person: Person, locale: Locale): PersonView {
  const balances: PersonBalance[] = [];
  if (person.owesYouCents > 0) {
    balances.push({
      direction: "receive",
      cents: person.owesYouCents,
      label: m.people_page_balance_owes_you(),
    });
  }
  if (person.youOweCents > 0) {
    balances.push({
      direction: "pay",
      cents: person.youOweCents,
      label: m.people_page_balance_you_owe(),
    });
  }
  return {
    accountText: accountText(person.account),
    balances,
    contractsLine: contractsLine(person, locale),
    tag: tagOf(person, locale),
  };
}

/** What a contract line of the sheet says under its title: "Você paga · 6 de 10 pagas". */
export function contractMeta(contract: PersonContract): string {
  const who =
    contract.direction === "pay"
      ? m.contracts_role_pay()
      : m.contracts_role_receive();
  return `${who} ${m.contract_sep()} ${m.people_page_contract_progress({
    paid: contract.paidCount,
    total: contract.installmentsCount,
  })}`;
}

/**
 * Whether the sheet shows each contract's own amount: only when two or more
 * are open in the same direction, since otherwise it repeats the balance
 * (mockup 17, decision 6).
 */
export function showsContractAmounts(person: Person): boolean {
  const open = person.contracts.filter((c) => !c.settled);
  return (
    open.filter((c) => c.direction === "receive").length > 1 ||
    open.filter((c) => c.direction === "pay").length > 1
  );
}
