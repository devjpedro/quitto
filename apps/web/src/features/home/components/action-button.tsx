import {
  FileMagnifyingGlass,
  ListBullets,
  QrCode,
  WhatsappLogo,
} from "@phosphor-icons/react";
import type { Locale } from "@quitto/shared";
import { Link } from "@tanstack/react-router";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  chargeMessage,
  groupChargeMessage,
  whatsappUrl,
} from "@/features/installments/lib/whatsapp-message";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { type ActionButtonKind, LINK_BUTTONS } from "../lib/action-view";
import type { HomeAction } from "../types";

export type CardButtonVariant = "onBrand" | "onBrandOutline" | "inset";

const LABEL: Record<ActionButtonKind, () => string> = {
  pix: m.home_action_pix,
  mark_paid: m.home_action_mark_paid,
  send_proof: m.home_action_send_proof,
  whatsapp: m.home_action_whatsapp,
  mark_received: m.home_action_mark_received,
  review: m.home_action_review,
  confirm: m.home_action_confirm,
  resend_proof: m.home_action_resend_proof,
  accept: m.home_action_accept,
  decline: m.home_action_decline,
  pay_oldest: m.home_action_pay_oldest,
  see_installments: m.home_action_see_installments,
};

function ButtonIcon({ kind }: { kind: ActionButtonKind }) {
  if (kind === "pix") {
    return <QrCode aria-hidden="true" size={16} weight="bold" />;
  }
  if (kind === "whatsapp") {
    return <WhatsappLogo aria-hidden="true" size={16} />;
  }
  if (kind === "review") {
    return <FileMagnifyingGlass aria-hidden="true" size={16} />;
  }
  return null;
}

export function ActionButton({
  action,
  busy,
  className,
  kind,
  locale,
  onRun,
  today,
  tryLock,
  variant,
}: {
  action: HomeAction;
  busy: boolean;
  className?: string;
  kind: ActionButtonKind;
  locale: Locale;
  onRun: (kind: ActionButtonKind) => void;
  today: string;
  tryLock: () => boolean;
  variant: CardButtonVariant;
}) {
  const label = LABEL[kind]();
  // A link runs no mutation, but it still answers to the list's lock: the
  // second hit of a double tap must not open the card that slid into place.
  const guard = (event: MouseEvent) => {
    if (!tryLock()) {
      event.preventDefault();
    }
  };
  if (action.kind !== "invite" && kind === "whatsapp") {
    const paragraphs =
      action.count > 1
        ? groupChargeMessage(
            {
              contractTitle: action.contractTitle,
              dueDate: action.dueDate,
              sequences: action.sequences,
              totalCents: action.totalCents,
            },
            locale
          )
        : chargeMessage({ ...action, todayISO: today }, locale);
    const href = whatsappUrl(paragraphs);
    return (
      <Button asChild className={className} size="sm" variant={variant}>
        <a
          href={href}
          onClick={guard}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ButtonIcon kind={kind} />
          {label}
          {/* The space lives outside the span: the name computation trims an
              element's own text, so inside it the two words would glue. */}{" "}
          <span className="sr-only">{m.home_action_whatsapp_hint()}</span>
        </a>
      </Button>
    );
  }
  if (action.kind !== "invite" && kind === "see_installments") {
    // On a phone the label would break the row: a 44 px icon button, named by aria-label (mockup 13).
    return (
      <Button
        asChild
        className={cn("max-md:w-11 max-md:px-0", className)}
        size="sm"
        variant={variant}
      >
        <Link
          aria-label={label}
          onClick={guard}
          params={{ id: action.contractId }}
          search={{ status: "overdue" }}
          to="/contracts/$id"
        >
          <ListBullets aria-hidden="true" className="md:hidden" size={18} />
          <span className="max-md:hidden">{label}</span>
        </Link>
      </Button>
    );
  }
  if (action.kind !== "invite" && LINK_BUTTONS.has(kind)) {
    return (
      <Button asChild className={className} size="sm" variant={variant}>
        <Link
          onClick={guard}
          params={{ id: action.contractId }}
          search={{ installment: action.installmentId }}
          to="/contracts/$id"
        >
          <ButtonIcon kind={kind} />
          {label}
        </Link>
      </Button>
    );
  }
  return (
    <Button
      className={className}
      disabled={busy}
      onClick={() => onRun(kind)}
      size="sm"
      variant={variant}
    >
      <ButtonIcon kind={kind} />
      {label}
    </Button>
  );
}
