import { CaretRight } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Money } from "@/components/ui/money";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { SectionTitle } from "@/components/ui/section-title";
import { Tag } from "@/components/ui/tag";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import {
  contractMeta,
  personView,
  showsContractAmounts,
} from "../lib/person-view";
import type { Person, PersonContract } from "../types";

function ContractTag({
  contract,
  today,
}: {
  contract: PersonContract;
  today: string;
}) {
  if (contract.settled) {
    return (
      <Tag className="self-center" tone="brand">
        {m.contracts_tag_settled()}
      </Tag>
    );
  }
  if (contract.overdueCount > 0) {
    return (
      <Tag className="self-center" tone="danger">
        {m.contract_tag_overdue()}
      </Tag>
    );
  }
  if (contract.reviewCount > 0) {
    return (
      <Tag className="self-center" tone="warning">
        {contract.direction === "receive"
          ? m.contract_tag_review_receive()
          : m.contract_tag_review_view()}
      </Tag>
    );
  }
  return contract.nextDueDate === today ? (
    <Tag className="self-center" tone="ink">
      {m.contract_tag_today()}
    </Tag>
  ) : null;
}

function ContractLine({
  amounts,
  contract,
  today,
}: {
  amounts: boolean;
  contract: PersonContract;
  today: string;
}) {
  return (
    <Link
      className="flex min-h-16 items-center gap-3 rounded-[inherit] py-2.5 pr-3 pl-2.5 transition-colors hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      data-testid={`person-contract-${contract.contractId}`}
      params={{ id: contract.contractId }}
      to="/contracts/$id"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-surface-inset">
        <ProgressRing
          percent={(contract.paidCount / contract.installmentsCount) * 100}
          size={24}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-sm">
          {contract.title}
        </span>
        <span className="mt-0.5 block text-[12.5px] text-ink-muted tabular-nums">
          {contractMeta(contract)}
        </span>
      </span>
      {amounts && !contract.settled ? (
        <Money
          cents={contract.remainingCents}
          className={
            contract.direction === "receive" ? "text-brand" : "text-ink"
          }
          size="list"
        />
      ) : null}
      <ContractTag contract={contract} today={today} />
      <CaretRight
        aria-hidden="true"
        className="shrink-0 text-ink-muted"
        size={14}
      />
    </Link>
  );
}

/**
 * The person (mockup 17, frame E): their face and account in the header, the
 * balance in one cell per direction, and a block with each contract and its
 * ring. No state tag here (the card has it), and the amount per contract only
 * with two or more open the same way.
 */
export function PersonSheet({
  onClose,
  person,
  today,
}: {
  onClose: () => void;
  person: Person;
  today: string;
}) {
  const locale = getLocale();
  const view = personView(person, locale);
  const amounts = showsContractAmounts(person);
  return (
    <ResponsiveSheet
      description={view.accountText ?? person.email ?? view.contractsLine}
      leading={<PersonAvatar name={person.name} size="lg" />}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      open
      title={person.name}
    >
      <div className="flex flex-col gap-5" data-testid="person-sheet">
        <div className="grid gap-0.5 overflow-hidden rounded-card">
          {view.balances.length === 0 ? (
            <div className="bg-surface-card px-4 py-3 font-medium text-sm">
              {m.people_page_settled()}
            </div>
          ) : (
            view.balances.map((balance) => (
              <div
                className="bg-surface-card px-4 py-3"
                key={balance.direction}
              >
                <p className="text-[12px] text-ink-muted">{balance.label}</p>
                <Money
                  cents={balance.cents}
                  className={
                    balance.direction === "receive" ? "text-brand" : "text-ink"
                  }
                  size="milestone"
                />
              </div>
            ))
          )}
        </div>
        <section aria-labelledby="person-contracts">
          <SectionTitle id="person-contracts">
            {m.people_page_sheet_contracts()}
          </SectionTitle>
          <ul className="divide-y divide-divider overflow-hidden rounded-card bg-surface-card">
            {person.contracts.map((contract) => (
              <li
                className="first:rounded-t-card last:rounded-b-card"
                key={contract.contractId}
              >
                <ContractLine
                  amounts={amounts}
                  contract={contract}
                  today={today}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ResponsiveSheet>
  );
}
