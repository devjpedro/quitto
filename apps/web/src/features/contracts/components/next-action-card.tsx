import { FileMagnifyingGlass, QrCode } from "@phosphor-icons/react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { PersonText } from "@/components/ui/person-text";
import { Tag } from "@/components/ui/tag";
import {
  useMarkPaidMutation,
  useMarkReceivedMutation,
} from "@/features/installments/api";
import { useActionLock } from "@/hooks/use-action-lock";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { ContractRoute } from "../hooks/use-contract-route";
import { perspectiveOf } from "../lib/contract-view";
import {
  type CardButton,
  cardButtons,
  type NextAction,
  nextActionView,
  type PendingAction,
} from "../lib/next-action";
import type { ContractDetail } from "../types";
import { SettledCard } from "./settled-card";
import { type CardVariant, WhatsappButton } from "./whatsapp-charge-button";

/**
 * "Lembrar no WhatsApp" and "Marcar como recebida" side by side need about
 * 372 px: narrower (a phone, the 400 px card beside the hero) each takes a
 * whole row, never one left alone (as the home's cards, decision 16).
 */
const STACK_BELOW: Partial<Record<string, string>> = {
  "whatsapp_remind,mark_received": "@max-[23.5rem]:w-full",
};

/** A mark in flight: dimmed and inert as `disabled`, but it keeps the focus (WCAG 2.4.3). */
const HELD = "aria-disabled:pointer-events-none aria-disabled:opacity-50";

const OPEN_LABEL: Partial<Record<CardButton, () => string>> = {
  open_oldest: m.contract_action_open_oldest,
  pay_oldest: m.home_action_pay_oldest,
  review: m.contract_action_review,
  pay_pix: m.home_action_pix,
  resend: m.home_action_resend_proof,
};

function OpenIcon({ kind }: { kind: CardButton }) {
  if (kind === "pay_pix") {
    return <QrCode aria-hidden="true" size={16} weight="bold" />;
  }
  if (kind === "review") {
    return <FileMagnifyingGlass aria-hidden="true" size={16} />;
  }
  return null;
}

/** The green card (mockup 14, enxuto): no bar (the top has it), no "de 10", no date. */
function GreenCard({
  action,
  detail,
  route,
  tryLock,
}: {
  action: PendingAction;
  detail: ContractDetail;
  route: ContractRoute;
  tryLock: () => boolean;
}) {
  const locale = getLocale();
  const titleId = useId();
  const view = nextActionView(action, detail, route.today, locale);
  const buttons = cardButtons(
    action,
    perspectiveOf(detail.role),
    detail.contract.requiresConfirmation
  );
  const stack = STACK_BELOW[buttons.join()];
  const id = view.installment.id;
  // Held by the card, not by the button: the optimistic mark moves the card
  // on to the next action at once, and the request keeps its observer.
  const received = useMarkReceivedMutation(
    detail.contract.id,
    detail.contract.requiresConfirmation
  );
  const paid = useMarkPaidMutation(detail.contract.id);
  // The mark moves the card on at once, to the next installment with the
  // same button in the same place (review I1): while one is in flight no
  // other starts, and the lock swallows the second hit of a double tap even
  // when the answer came before it.
  const busy = received.isPending || paid.isPending;
  const button = (kind: CardButton, index: number) => {
    const variant: CardVariant = index === 0 ? "onBrand" : "onBrandOutline";
    if (kind === "whatsapp_charge" || kind === "whatsapp_remind") {
      return (
        <WhatsappButton
          action={action}
          className={stack}
          detail={detail}
          key={kind}
          kind={kind}
          today={route.today}
          tryLock={tryLock}
          variant={variant}
          view={view}
        />
      );
    }
    if (kind === "mark_received" || kind === "mark_paid") {
      const mutation = kind === "mark_received" ? received : paid;
      return (
        <Button
          aria-disabled={busy || undefined}
          className={cn(stack, HELD)}
          key={kind}
          onClick={() => {
            if (!busy && tryLock()) {
              mutation.mutate(id);
            }
          }}
          size="sm"
          variant={variant}
        >
          {kind === "mark_received"
            ? m.home_action_mark_received()
            : m.home_action_mark_paid()}
        </Button>
      );
    }
    return (
      <Button
        className={stack}
        key={kind}
        onClick={() => {
          if (tryLock()) {
            route.openInstallment(id);
          }
        }}
        size="sm"
        variant={variant}
      >
        <OpenIcon kind={kind} />
        {OPEN_LABEL[kind]?.()}
      </Button>
    );
  };
  return (
    <article
      aria-labelledby={titleId}
      className="@container flex flex-col rounded-card bg-brand-surface px-[18px] pt-4 pb-[18px] text-on-brand"
      data-testid="next-action-card"
    >
      <Tag tone="highlight">{view.tag}</Tag>
      <p className="mt-3.5 truncate font-medium text-sm" id={titleId}>
        {view.title}
      </p>
      <Money cents={view.amountCents} className="mt-0.5 block" size="card" />
      {view.person ? (
        <p className="mt-2 flex min-w-0 items-center gap-2 text-[13px] text-on-brand-muted">
          <PersonAvatar name={view.person.name} />
          <PersonText line={view.person} strong="text-on-brand" />
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {buttons.map(button)}
      </div>
    </article>
  );
}

/**
 * The next action's card: green with what to do now (in the home's order),
 * lime once the contract is settled. The viewer has none (the slot returns
 * null before this renders). The lock lives here, above both: the last mark
 * turns the green card into the lime one under the second hit too.
 */
export function NextActionCard({
  action,
  detail,
  route,
}: {
  action: NextAction;
  detail: ContractDetail;
  route: ContractRoute;
}) {
  const tryLock = useActionLock();
  if (action.kind === "settled") {
    return <SettledCard detail={detail} route={route} tryLock={tryLock} />;
  }
  return (
    <GreenCard
      action={action}
      detail={detail}
      route={route}
      tryLock={tryLock}
    />
  );
}
