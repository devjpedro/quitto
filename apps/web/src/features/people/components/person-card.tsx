import { CheckCircle, Hourglass, WarningCircle } from "@phosphor-icons/react";
import { Money } from "@/components/ui/money";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import { getLocale } from "@/paraglide/runtime.js";
import { type PersonTag, personView } from "../lib/person-view";
import type { Person } from "../types";

const TAG_ICON = {
  overdue: WarningCircle,
  review: Hourglass,
  ok: CheckCircle,
} as const;

export function PersonTagView({ tag }: { tag: PersonTag }) {
  const IconComponent = TAG_ICON[tag.icon];
  return (
    <Tag className="self-center" tone={tag.tone}>
      <IconComponent aria-hidden="true" size={12} weight="bold" />
      {tag.label}
    </Tag>
  );
}

function Balance({
  balance,
  size,
}: {
  balance: ReturnType<typeof personView>["balances"][number];
  size: "list" | "milestone";
}) {
  return (
    <span className="flex flex-col items-start leading-tight">
      <span className="text-[12px] text-ink-muted">{balance.label}</span>
      <Money
        cents={balance.cents}
        className={balance.direction === "receive" ? "text-brand" : "text-ink"}
        size={size}
      />
    </span>
  );
}

/** The phone's row: face, name and the balance on one line, the account and contracts under, the state last. */
function Row({ person }: { person: Person }) {
  const view = personView(person, getLocale());
  return (
    <div className="flex items-start gap-3 md:hidden">
      <PersonAvatar name={person.name} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate font-medium text-[15px]">
            {person.name}
          </span>
          <span className="flex shrink-0 flex-col items-end">
            {view.balances.map((balance) => (
              <span
                className="flex items-baseline gap-1.5"
                key={balance.direction}
              >
                <span className="text-[12px] text-ink-muted">
                  {balance.label.toLowerCase()}
                </span>
                <Money
                  cents={balance.cents}
                  className={cn(
                    balance.direction === "receive" ? "text-brand" : "text-ink"
                  )}
                  sign={balance.direction === "receive" ? "+" : undefined}
                  size="list"
                />
              </span>
            ))}
          </span>
        </div>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">
          {[view.accountText ?? person.email, view.contractsLine]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-1.5">
          <PersonTagView tag={view.tag} />
        </div>
      </div>
    </div>
  );
}

/** The card from md: the balance as the headline, each contract with its ring at the foot. */
function Card({ person }: { person: Person }) {
  const view = personView(person, getLocale());
  return (
    <div className="hidden flex-col gap-3 md:flex">
      <div className="flex items-start gap-3">
        <PersonAvatar name={person.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-[15px]">{person.name}</p>
          <p className="truncate text-[12.5px] text-ink-muted">
            {view.accountText ?? person.email ?? view.contractsLine}
          </p>
        </div>
        <PersonTagView tag={view.tag} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {view.balances.length === 0 ? (
          <span className="text-[13px] text-ink-muted">{view.tag.label}</span>
        ) : (
          view.balances.map((balance) => (
            <Balance
              balance={balance}
              key={balance.direction}
              size="milestone"
            />
          ))
        )}
      </div>
      <ul className="flex flex-col gap-1.5 rounded-control bg-surface-inset px-3 py-2.5">
        {person.contracts.map((contract) => (
          <li
            className="flex items-center gap-2.5 text-[13px]"
            key={contract.contractId}
          >
            <ProgressRing
              percent={(contract.paidCount / contract.installmentsCount) * 100}
              size={16}
            />
            <span className="truncate">{contract.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One person (mockup 17, frame E): the face as the anchor, the account's
 * state, what is owed in each direction and the contracts. A button that
 * opens the sheet; on a phone it is a row of one block.
 */
export function PersonCard({
  onOpen,
  person,
}: {
  onOpen: (key: string) => void;
  person: Person;
}) {
  return (
    <button
      className="w-full rounded-[inherit] p-4 text-left transition-colors hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand max-md:focus-visible:ring-inset md:rounded-card md:bg-surface-card md:active:scale-[.97] motion-reduce:md:active:scale-100"
      data-person-key={person.key}
      data-testid={`person-card-${person.key}`}
      onClick={() => onOpen(person.key)}
      type="button"
    >
      <Row person={person} />
      <Card person={person} />
    </button>
  );
}
